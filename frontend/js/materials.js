// materials.js - materials grid + value calculator
// uses BACKEND_URL from config.js (loaded before this file)

var allMaterials = [];


// format a number as a US dollar string, with parens for negatives
// (e.g. -3.5 -> "($3.50)")
function formatUSD(n) {
    var abs = Math.abs(n);
    var s = '$' + abs.toFixed(2);
    if (n < 0) {
        return '(' + s + ')';
    }
    return s;
}


// build the html for one material card
function buildCard(m) {
    var div = document.createElement('div');
    div.className = 'material-card';

    var priceHtml;
    if (m.est_price_usd_per_lb === null || m.est_price_usd_per_lb === undefined) {
        priceHtml = '<div class="price na">price varies (see notes)</div>';
    } else if (m.est_price_usd_per_lb < 0) {
        priceHtml = '<div class="price negative">' + formatUSD(m.est_price_usd_per_lb) + ' / lb</div>'
                  + '<div class="range">you pay the recycler ' + formatUSD(Math.abs(m.price_range_high))
                  + ' to ' + formatUSD(Math.abs(m.price_range_low)) + ' per lb</div>';
    } else {
        priceHtml = '<div class="price">' + formatUSD(m.est_price_usd_per_lb) + ' / lb</div>'
                  + '<div class="range">typical range ' + formatUSD(m.price_range_low)
                  + ' to ' + formatUSD(m.price_range_high) + '</div>';
    }

    var foundIn = '';
    if (m.found_in && m.found_in.length > 0) {
        foundIn = '<div class="found-in"><strong>Found in:</strong> ' + m.found_in.join(', ') + '</div>';
    }

    div.innerHTML =
        '<h3>' + m.name + '</h3>'
      + '<div class="category">' + m.category + '</div>'
      + priceHtml
      + '<div class="description">' + m.description + '</div>'
      + foundIn
      + '<div class="source">Source: ' + m.price_source + '</div>';

    return div;
}


// fill in the material <select> in the calculator
function buildSelect(materials) {
    var sel = document.getElementById('calc-material');
    sel.innerHTML = '';

    // a blank prompt option first
    var prompt = document.createElement('option');
    prompt.value = '';
    prompt.textContent = '-- pick a material --';
    sel.appendChild(prompt);

    for (var i = 0; i < materials.length; i++) {
        var m = materials[i];
        var opt = document.createElement('option');
        opt.value = m.slug;
        opt.textContent = m.name;
        // mark materials without a price so the user knows
        if (m.est_price_usd_per_lb === null || m.est_price_usd_per_lb === undefined) {
            opt.textContent += ' (no per-lb estimate)';
        }
        sel.appendChild(opt);
    }
}


// render the grid of cards
function renderGrid(materials) {
    var grid = document.getElementById('materials-grid');
    grid.innerHTML = '';
    for (var i = 0; i < materials.length; i++) {
        grid.appendChild(buildCard(materials[i]));
    }
}


// runs when the user clicks the Estimate button
function runEstimate() {
    var slug = document.getElementById('calc-material').value;
    var lbsRaw = document.getElementById('calc-lbs').value;
    var lbs = parseFloat(lbsRaw);
    var result = document.getElementById('calc-result');

    if (!slug) {
        result.innerHTML = '<em>Please pick a material first.</em>';
        result.classList.add('show');
        return;
    }
    if (isNaN(lbs) || lbs < 0) {
        result.innerHTML = '<em>Pounds must be a positive number.</em>';
        result.classList.add('show');
        return;
    }

    fetch(BACKEND_URL + '/api/materials/estimate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({material: slug, lbs: lbs})
    })
        .then(function(resp) { return resp.json().then(function(j) { return {status: resp.status, body: j}; }); })
        .then(function(r) {
            if (r.status === 200) {
                var bigClass = r.body.estimated_value_usd < 0 ? 'big negative' : 'big';
                var verb = r.body.estimated_value_usd < 0 ? 'You would pay roughly' : 'Estimated value';
                result.innerHTML =
                    '<div>' + verb + ' for <strong>' + lbs + ' lbs</strong> of '
                      + r.body.material_name + ':</div>'
                  + '<div class="' + bigClass + '">' + formatUSD(r.body.estimated_value_usd) + '</div>'
                  + '<div class="range">range ' + formatUSD(r.body.low) + ' - '
                      + formatUSD(r.body.high) + ' at $' + r.body.unit_price_usd_per_lb.toFixed(2) + '/lb</div>'
                  + '<div class="disclaimer">' + r.body.note + '</div>';
            } else if (r.status === 422) {
                result.innerHTML = '<em>' + r.body.error + '. ' + r.body.note + '</em>';
            } else {
                result.innerHTML = '<em>Something went wrong: ' + (r.body.error || r.status) + '</em>';
            }
            result.classList.add('show');
        })
        .catch(function(err) {
            console.error('estimate failed:', err);
            // client-side fallback: compute it locally from the cached materials list
            // so the calculator still works if the backend is sleeping
            var m = null;
            for (var i = 0; i < allMaterials.length; i++) {
                if (allMaterials[i].slug === slug) { m = allMaterials[i]; break; }
            }
            if (!m || m.est_price_usd_per_lb === null) {
                result.innerHTML = '<em>Backend unavailable and no per-lb estimate cached for this material.</em>';
            } else {
                var v = m.est_price_usd_per_lb * lbs;
                var bigClass = v < 0 ? 'big negative' : 'big';
                var verb = v < 0 ? 'You would pay roughly' : 'Estimated value';
                result.innerHTML =
                    '<div>' + verb + ' for <strong>' + lbs + ' lbs</strong> of ' + m.name + ':</div>'
                  + '<div class="' + bigClass + '">' + formatUSD(v) + '</div>'
                  + '<div class="disclaimer">(estimated client-side - the backend was unreachable)</div>';
            }
            result.classList.add('show');
        });
}


// load materials from backend, fall back to static JSON on github pages
function loadMaterials() {
    fetch(BACKEND_URL + '/api/materials')
        .then(function(resp) {
            if (!resp.ok) throw new Error('backend returned ' + resp.status);
            return resp.json();
        })
        .then(function(materials) {
            allMaterials = materials;
            buildSelect(materials);
            renderGrid(materials);
        })
        .catch(function(err) {
            console.warn('backend fetch failed:', err);
            console.log('falling back to /data/materials.json');
            return fetch('data/materials.json')
                .then(function(resp) { return resp.json(); })
                .then(function(materials) {
                    allMaterials = materials;
                    buildSelect(materials);
                    renderGrid(materials);
                })
                .catch(function(err2) {
                    document.getElementById('materials-grid').innerHTML =
                        '<div class="loading">Could not load materials. Please try again later.</div>';
                    console.error('fallback also failed:', err2);
                });
        });
}


// wire things up once the DOM is ready
function init() {
    document.getElementById('calc-button').addEventListener('click', runEstimate);
    // also let Enter in the lbs field trigger an estimate
    document.getElementById('calc-lbs').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') runEstimate();
    });
    loadMaterials();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
