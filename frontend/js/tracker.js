// tracker.js - recycling log, points, tier progress, CO2 estimates
//
// everything lives in localStorage under one key. nothing leaves the browser.
// uses BACKEND_URL from config.js but falls back to /data/*.json if needed.

var STORAGE_KEY = 'scraptronic_user_state';
var SCHEMA_VERSION = 1;


// CO2-saved-per-pound estimates derived from the EPA Waste Reduction Model
// (WARM v15, last updated Dec 2023). WARM gives MTCO2E per short ton; we
// converted: 1 MTCO2E = 2204.62 lbs CO2, 1 short ton = 2000 lbs.
//   ex: aluminum cans = 9.13 MTCO2E/short ton recycled vs landfilled
//       => 9.13 * 2204.62 / 2000 = 10.06 lbs CO2 saved per lb recycled.
//
// for materials not directly in WARM (brass, batteries, hard drives, CRT),
// values are approximations from related WARM categories - intentionally
// conservative. all numbers are estimates, not promises.
var CO2_SAVED_PER_LB = {
    aluminum: 10.06,            // WARM "aluminum cans" recycled vs landfilled
    copper: 4.50,               // WARM "copper wire" recycled vs landfilled
    steel: 2.03,                // WARM "steel cans" recycled vs landfilled
    brass: 3.50,                // approx from copper/zinc analogs
    circuit_boards: 0.70,       // WARM "mixed electronics"
    gold_from_boards: 0,        // not relevant - reported under circuit_boards
    lithium_ion_batteries: 5.00,// approx, avoided cobalt/nickel mining impact
    lead_acid_batteries: 1.50,  // approx
    hard_drives: 1.20,          // mixed steel/aluminum
    crt_glass: 0.20             // small positive but recycling is energy-intensive
};


// the four progress tiers. each entry has a min/max points window.
var TIERS = [
    { name: 'Seedling', icon: '🌱', min: 0,    max: 100 },
    { name: 'Sapling',  icon: '🌿', min: 101,  max: 500 },
    { name: 'Tree',     icon: '🌳', min: 501,  max: 2000 },
    { name: 'Forest',   icon: '🌲', min: 2001, max: Infinity }
];


// cached lookup tables loaded from the api
var materialsBySlug = {};
var recyclersById = {};


// ---------- storage helpers ----------

function emptyState() {
    return {
        version: SCHEMA_VERSION,
        created_at: new Date().toISOString(),
        entries: [],
        totals: {
            lbs_recycled: 0,
            estimated_value_usd: 0,
            points: 0,
            co2_saved_lbs_est: 0
        },
        current_tier: 'Seedling'
    };
}


function loadState() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyState();
        var parsed = JSON.parse(raw);
        // very simple migration: if version doesn't match, start fresh
        if (parsed.version !== SCHEMA_VERSION) {
            console.warn('schema mismatch, starting fresh');
            return emptyState();
        }
        return parsed;
    } catch (e) {
        console.error('failed to read state:', e);
        return emptyState();
    }
}


function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        // quota exceeded or private browsing - tell the user but don't crash
        console.error('failed to save state:', e);
        alert('Sorry - your browser refused to save the entry. ' +
              '(localStorage quota or private-mode restriction.)');
    }
}


// ---------- points + tier math ----------

// points for a single entry:
//   - 10 points per pound
//   - 5 point flat bonus per entry
//   - 50 bonus points if this is the first time logging this material
function pointsForEntry(material, lbs, state) {
    var points = lbs * 10 + 5;
    // check if any prior entry used the same material
    var firstTime = true;
    for (var i = 0; i < state.entries.length; i++) {
        if (state.entries[i].material === material) {
            firstTime = false;
            break;
        }
    }
    if (firstTime) {
        points += 50;
    }
    return Math.round(points);
}


function tierForPoints(points) {
    for (var i = 0; i < TIERS.length; i++) {
        if (points >= TIERS[i].min && points <= TIERS[i].max) {
            return TIERS[i];
        }
    }
    return TIERS[0];
}


// ---------- totals (recompute from entries on every change) ----------

function recomputeTotals(state) {
    var lbs = 0;
    var value = 0;
    var points = 0;
    var co2 = 0;
    for (var i = 0; i < state.entries.length; i++) {
        var e = state.entries[i];
        lbs += e.lbs;
        value += e.estimated_value_usd || 0;
        points += e.points_awarded || 0;
        co2 += e.co2_saved_lbs || 0;
    }
    state.totals.lbs_recycled = Math.round(lbs * 100) / 100;
    state.totals.estimated_value_usd = Math.round(value * 100) / 100;
    state.totals.points = Math.round(points);
    state.totals.co2_saved_lbs_est = Math.round(co2 * 10) / 10;
    state.current_tier = tierForPoints(state.totals.points).name;
}


// ---------- rendering ----------

function formatUSD(n) {
    var abs = Math.abs(n);
    var s = '$' + abs.toFixed(2);
    if (n < 0) return '(' + s + ')';
    return s;
}


function renderStats(state) {
    document.getElementById('stat-lbs').textContent = state.totals.lbs_recycled;
    document.getElementById('stat-value').textContent = formatUSD(state.totals.estimated_value_usd);
    document.getElementById('stat-co2').textContent = state.totals.co2_saved_lbs_est + ' lbs';
    document.getElementById('stat-points').textContent = state.totals.points;

    // muted styling if everything is at zero
    var muted = state.totals.points === 0;
    var ids = ['stat-lbs', 'stat-value', 'stat-co2', 'stat-points'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (muted) el.classList.add('muted');
        else el.classList.remove('muted');
    }
}


function renderTier(state) {
    var tier = tierForPoints(state.totals.points);
    document.getElementById('tier-name').textContent = tier.name;
    document.getElementById('tier-icon').textContent = tier.icon;

    var fill = document.getElementById('tier-fill');
    var progressText = document.getElementById('tier-progress-text');

    if (tier.max === Infinity) {
        // top tier - just show the score
        fill.style.width = '100%';
        progressText.textContent = state.totals.points + ' points (top tier)';
    } else {
        var span = tier.max - tier.min + 1;
        var into = state.totals.points - tier.min;
        var pct = Math.max(0, Math.min(100, (into / span) * 100));
        fill.style.width = pct + '%';
        var toGo = tier.max + 1 - state.totals.points;
        progressText.textContent = state.totals.points + ' points · ' +
            toGo + ' more to ' + nextTier(tier).name;
    }
}


function nextTier(tier) {
    for (var i = 0; i < TIERS.length; i++) {
        if (TIERS[i].name === tier.name) {
            return i + 1 < TIERS.length ? TIERS[i + 1] : tier;
        }
    }
    return tier;
}


function renderEntries(state) {
    var list = document.getElementById('entries-list');
    if (state.entries.length === 0) {
        list.innerHTML = '<div class="entries-empty">No entries yet. Add your first one above.</div>';
        return;
    }

    // newest first
    var sorted = state.entries.slice();
    sorted.sort(function(a, b) { return b.id - a.id; });

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
        var e = sorted[i];
        var mat = materialsBySlug[e.material];
        var matName = mat ? mat.name : e.material;
        var recycler = e.recycler_id ? recyclersById[e.recycler_id] : null;
        var recyclerName = recycler ? recycler.name : '';

        var valueClass = e.estimated_value_usd < 0 ? 'value negative' : 'value';

        html +=
            '<div class="entry-row">' +
              '<div class="main">' +
                '<div class="mat">' + e.lbs + ' lbs of ' + matName + '</div>' +
                (recyclerName ? '<div class="extra">at ' + recyclerName + '</div>' : '') +
              '</div>' +
              '<div class="meta">' + e.date + '</div>' +
              '<div class="' + valueClass + '">' + formatUSD(e.estimated_value_usd) + '</div>' +
              '<div class="delete">' +
                '<button data-id="' + e.id + '">remove</button>' +
              '</div>' +
            '</div>';
    }
    list.innerHTML = html;

    // wire up remove buttons
    var buttons = list.querySelectorAll('.delete button');
    for (var j = 0; j < buttons.length; j++) {
        buttons[j].addEventListener('click', function() {
            removeEntry(parseInt(this.getAttribute('data-id'), 10));
        });
    }
}


function renderAll(state) {
    renderStats(state);
    renderTier(state);
    renderEntries(state);
}


// ---------- actions ----------

function addEntry() {
    var slug = document.getElementById('entry-material').value;
    var lbsRaw = document.getElementById('entry-lbs').value;
    var date = document.getElementById('entry-date').value;
    var recyclerId = document.getElementById('entry-recycler').value;
    var msg = document.getElementById('form-msg');

    msg.classList.remove('show');

    if (!slug) {
        msg.textContent = 'Pick a material.';
        msg.classList.add('show');
        return;
    }
    var lbs = parseFloat(lbsRaw);
    if (isNaN(lbs) || lbs <= 0) {
        msg.textContent = 'Pounds must be a positive number.';
        msg.classList.add('show');
        return;
    }
    if (!date) {
        date = new Date().toISOString().slice(0, 10);
    }

    var state = loadState();

    var mat = materialsBySlug[slug];
    var price = (mat && mat.est_price_usd_per_lb) || 0;
    var value = Math.round(price * lbs * 100) / 100;
    var co2 = Math.round((CO2_SAVED_PER_LB[slug] || 0) * lbs * 10) / 10;
    var points = pointsForEntry(slug, lbs, state);

    var entry = {
        id: Date.now(),
        date: date,
        material: slug,
        lbs: lbs,
        recycler_id: recyclerId || null,
        estimated_value_usd: value,
        points_awarded: points,
        co2_saved_lbs: co2
    };
    state.entries.push(entry);
    recomputeTotals(state);
    saveState(state);
    renderAll(state);

    // reset the form for the next entry but keep date stuck on today
    document.getElementById('entry-material').value = '';
    document.getElementById('entry-lbs').value = '1';
    document.getElementById('entry-recycler').value = '';
}


function removeEntry(id) {
    var state = loadState();
    var kept = [];
    for (var i = 0; i < state.entries.length; i++) {
        if (state.entries[i].id !== id) {
            kept.push(state.entries[i]);
        }
    }
    state.entries = kept;
    recomputeTotals(state);
    saveState(state);
    renderAll(state);
}


function exportData() {
    var state = loadState();
    var json = JSON.stringify(state, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'scraptronic-recycling-log.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


function resetAll() {
    var confirmed = confirm(
        'This will permanently clear all your recycling entries from this browser. ' +
        'Are you sure?'
    );
    if (!confirmed) return;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error(e);
    }
    renderAll(emptyState());
}


// ---------- bootstrap (load materials + recyclers, then render) ----------

function fetchWithFallback(apiPath, staticPath) {
    return fetch(BACKEND_URL + apiPath)
        .then(function(resp) {
            if (!resp.ok) throw new Error('backend returned ' + resp.status);
            return resp.json();
        })
        .catch(function(err) {
            console.warn('backend fetch ' + apiPath + ' failed, trying static fallback');
            return fetch(staticPath).then(function(resp) { return resp.json(); });
        });
}


function populateMaterialSelect(materials) {
    var sel = document.getElementById('entry-material');
    sel.innerHTML = '';
    var prompt = document.createElement('option');
    prompt.value = '';
    prompt.textContent = '-- pick a material --';
    sel.appendChild(prompt);
    for (var i = 0; i < materials.length; i++) {
        materialsBySlug[materials[i].slug] = materials[i];
        var opt = document.createElement('option');
        opt.value = materials[i].slug;
        opt.textContent = materials[i].name;
        sel.appendChild(opt);
    }
}


function populateRecyclerSelect(recyclers) {
    var sel = document.getElementById('entry-recycler');
    // keep the "not specified" first option that's already there
    for (var i = 0; i < recyclers.length; i++) {
        recyclersById[recyclers[i].id] = recyclers[i];
        var opt = document.createElement('option');
        opt.value = recyclers[i].id;
        opt.textContent = recyclers[i].name;
        sel.appendChild(opt);
    }
}


function init() {
    // default date input to today
    var today = new Date().toISOString().slice(0, 10);
    document.getElementById('entry-date').value = today;

    // wire up buttons
    document.getElementById('entry-submit').addEventListener('click', addEntry);
    document.getElementById('export-button').addEventListener('click', exportData);
    document.getElementById('reset-button').addEventListener('click', resetAll);

    // initial render from whatever's in localStorage
    renderAll(loadState());

    // pull materials + recyclers to populate the form
    fetchWithFallback('/api/materials', 'data/materials.json')
        .then(populateMaterialSelect)
        .catch(function(err) {
            console.error('could not load materials:', err);
        });

    fetchWithFallback('/api/recyclers', 'data/recyclers.json')
        .then(populateRecyclerSelect)
        .catch(function(err) {
            console.error('could not load recyclers:', err);
        });
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
