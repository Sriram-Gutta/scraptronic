// scroll-fx.js - small scroll-driven effects shared across pages.
//
// today it just handles fade-in-on-scroll for elements tagged with
// class="fade-in". feel free to grow it.

function observeFadeIns() {
    var els = document.querySelectorAll('.fade-in');
    if (els.length === 0) return;

    // really old browsers don't have IntersectionObserver - just show
    // everything so we don't end up with a blank page
    if (!('IntersectionObserver' in window)) {
        for (var i = 0; i < els.length; i++) {
            els[i].classList.add('visible');
        }
        return;
    }

    // stagger the reveals a little so the cards don't all snap at once
    var observer = new IntersectionObserver(function(entries) {
        for (var j = 0; j < entries.length; j++) {
            var entry = entries[j];
            if (!entry.isIntersecting) continue;
            var idx = parseInt(entry.target.getAttribute('data-fade-idx') || '0', 10);
            var delay = Math.min(idx, 6) * 80;  // up to ~500ms cap
            setTimeout(function(el) {
                return function() { el.classList.add('visible'); };
            }(entry.target), delay);
            observer.unobserve(entry.target);
        }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    for (var k = 0; k < els.length; k++) {
        els[k].setAttribute('data-fade-idx', k);
        observer.observe(els[k]);
    }
}


function init() {
    observeFadeIns();
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
