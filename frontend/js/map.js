// map.js - leaflet map + sidebar of recyclers
// uses BACKEND_URL from config.js (loaded before this file)

// keep references to map and markers so we can interact with them later
var map = null;
var markers = {};  // id -> Leaflet marker
var allRecyclers = [];


// nicer display name for a material slug like "circuit_boards"
function prettyMaterial(slug) {
    var parts = slug.split('_');
    var out = '';
    for (var i = 0; i < parts.length; i++) {
        out += parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
        if (i < parts.length - 1) out += ' ';
    }
    return out;
}


// build the html that appears inside a marker's popup
function buildPopupHtml(r) {
    var html = '';
    html += '<div class="popup-name">' + r.name + '</div>';
    html += '<div class="popup-row">' + r.address + '</div>';
    if (r.phone) {
        html += '<div class="popup-row">📞 <a href="tel:' + r.phone + '">' + r.phone + '</a></div>';
    }
    if (r.website) {
        html += '<div class="popup-row">🌐 <a href="' + r.website + '" target="_blank" rel="noopener">website</a></div>';
    }
    if (r.notes) {
        html += '<div class="popup-row"><em>' + r.notes + '</em></div>';
    }
    // materials as little tags
    if (r.accepted_materials && r.accepted_materials.length > 0) {
        html += '<div class="popup-mats"><strong>Accepts:</strong><br>';
        for (var i = 0; i < r.accepted_materials.length; i++) {
            html += '<span class="tag">' + prettyMaterial(r.accepted_materials[i]) + '</span>';
        }
        html += '</div>';
    }
    return html;
}


// build a sidebar item that the user can click to focus the map
function buildSidebarItem(r) {
    var div = document.createElement('div');
    div.className = 'recycler-item';
    div.id = 'side-' + r.id;
    div.innerHTML = '<h4>' + r.name + '</h4><div class="addr">' + r.address + '</div>';
    div.addEventListener('click', function() {
        // pan/zoom to this recycler and open its popup
        map.setView([r.lat, r.lng], 14, {animate: true});
        markers[r.id].openPopup();
        // visual highlight
        var items = document.querySelectorAll('.recycler-item');
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove('selected');
        }
        div.classList.add('selected');
    });
    return div;
}


// render all the markers and the sidebar from the loaded recycler list
function render(recyclers) {
    allRecyclers = recyclers;

    // clear any existing markers
    for (var id in markers) {
        map.removeLayer(markers[id]);
    }
    markers = {};

    // clear the sidebar
    var sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';

    // add a marker for each recycler
    for (var i = 0; i < recyclers.length; i++) {
        var r = recyclers[i];
        var marker = L.marker([r.lat, r.lng]).addTo(map);
        marker.bindPopup(buildPopupHtml(r));
        markers[r.id] = marker;
        sidebar.appendChild(buildSidebarItem(r));
    }

    console.log('rendered ' + recyclers.length + ' recyclers');
}


// fetch the recycler list from the backend
// if the backend is sleeping, fall back to the static JSON published with the
// frontend by the github actions workflow
function loadRecyclers() {
    fetch(BACKEND_URL + '/api/recyclers')
        .then(function(resp) {
            if (!resp.ok) throw new Error('backend returned ' + resp.status);
            return resp.json();
        })
        .then(render)
        .catch(function(err) {
            console.warn('backend fetch failed:', err);
            console.log('falling back to /data/recyclers.json from github pages');
            return fetch('data/recyclers.json')
                .then(function(resp) { return resp.json(); })
                .then(render)
                .catch(function(err2) {
                    document.getElementById('sidebar').innerHTML =
                        '<div class="loading">Could not load recyclers. Please try again later.</div>';
                    console.error('fallback also failed:', err2);
                });
        });
}


// set up the map and kick off loading
function init() {
    // center on San Diego, zoomed out enough to see the county
    map = L.map('map').setView([32.83, -117.15], 10);

    // OpenStreetMap tiles - free, no api key needed
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    loadRecyclers();
}


// wait until the DOM is ready, then kick everything off
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
