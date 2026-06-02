// learn.js - drives both the article index (learn.html) and
// the single article view (learn-article.html). figures out which
// one we're on by looking at the page's DOM.

// ---------- tiny markdown renderer ----------
// supports the subset i actually used when writing the articles:
//   ## heading  /  ### heading
//   **bold**, *italic*
//   [text](url)
//   - list item  (or  * list item)
//   blank line = new paragraph

function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}


function renderInline(s) {
    // escape first, then add formatting tags. order matters here -
    // we have to do **bold** before *italic* or the bold markers
    // would each look like an italic open + close.
    var out = escapeHtml(s);
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return out;
}


function renderMarkdown(md) {
    var lines = md.split('\n');
    var out = '';
    var paragraph = [];      // accumulating plain lines
    var listItems = null;    // accumulating <li> entries, or null

    function flushParagraph() {
        if (paragraph.length > 0) {
            out += '<p>' + renderInline(paragraph.join(' ')) + '</p>\n';
            paragraph = [];
        }
    }
    function flushList() {
        if (listItems !== null) {
            out += '<ul>\n' + listItems.join('') + '</ul>\n';
            listItems = null;
        }
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var stripped = line.replace(/\s+$/, '');

        if (stripped === '') {
            flushParagraph();
            flushList();
            continue;
        }

        // headings
        if (stripped.indexOf('### ') === 0) {
            flushParagraph();
            flushList();
            out += '<h3>' + renderInline(stripped.slice(4)) + '</h3>\n';
            continue;
        }
        if (stripped.indexOf('## ') === 0) {
            flushParagraph();
            flushList();
            out += '<h2>' + renderInline(stripped.slice(3)) + '</h2>\n';
            continue;
        }
        if (stripped.indexOf('# ') === 0) {
            flushParagraph();
            flushList();
            out += '<h1>' + renderInline(stripped.slice(2)) + '</h1>\n';
            continue;
        }

        // list items
        if (stripped.indexOf('- ') === 0 || stripped.indexOf('* ') === 0) {
            flushParagraph();
            if (listItems === null) listItems = [];
            listItems.push('<li>' + renderInline(stripped.slice(2)) + '</li>\n');
            continue;
        }

        // ordinary line - accumulate into the current paragraph
        flushList();
        paragraph.push(stripped);
    }

    // tail flush in case the last block has no trailing blank line
    flushParagraph();
    flushList();

    return out;
}


// ---------- shared fetch + fallback ----------

function fetchWithFallback(apiPath, staticPath) {
    return fetch(BACKEND_URL + apiPath)
        .then(function(resp) {
            if (!resp.ok) throw new Error('backend returned ' + resp.status);
            return resp.json();
        })
        .catch(function(err) {
            console.warn('backend fetch ' + apiPath + ' failed, trying static fallback');
            return fetch(staticPath).then(function(resp) {
                if (!resp.ok) throw new Error('fallback returned ' + resp.status);
                return resp.json();
            });
        });
}


// ---------- index page (learn.html) ----------

function renderArticleCards(articles) {
    var grid = document.getElementById('article-grid');
    if (!articles || articles.length === 0) {
        grid.innerHTML = '<div class="loading">No articles yet.</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < articles.length; i++) {
        var a = articles[i];
        html +=
            '<a class="article-card" href="learn-article.html?slug=' + encodeURIComponent(a.slug) + '">' +
              '<h3>' + escapeHtml(a.title) + '</h3>' +
              '<p class="preview">' + escapeHtml(a.preview) + '</p>' +
              '<div class="meta">' +
                '<span>' + a.reading_time_min + ' min read</span>' +
                '<span>Updated ' + a.last_updated + '</span>' +
              '</div>' +
            '</a>';
    }
    grid.innerHTML = html;
}


function initIndex() {
    fetchWithFallback('/api/articles', 'data/articles.json')
        .then(function(articles) {
            // when we fall back to the static file we get full article
            // objects (with body_md); the api endpoint returns just the
            // summary. either works for the grid.
            renderArticleCards(articles);
        })
        .catch(function(err) {
            console.error('failed to load articles:', err);
            document.getElementById('article-grid').innerHTML =
                '<div class="loading">Could not load articles. Please try again later.</div>';
        });
}


// ---------- single article page (learn-article.html) ----------

function renderArticle(a) {
    var sourcesHtml = '';
    if (a.sources && a.sources.length > 0) {
        sourcesHtml += '<div class="sources"><h4>Sources</h4><ul>';
        for (var i = 0; i < a.sources.length; i++) {
            var s = a.sources[i];
            sourcesHtml +=
                '<li><a href="' + encodeURI(s.url) + '" target="_blank" rel="noopener">' +
                  escapeHtml(s.label) + '</a></li>';
        }
        sourcesHtml += '</ul></div>';
    }

    var host = document.getElementById('article-host');
    host.innerHTML =
        '<article class="article">' +
          '<a class="back-link" href="learn.html">&larr; Back to Learn</a>' +
          '<h1>' + escapeHtml(a.title) + '</h1>' +
          '<div class="meta">' + a.reading_time_min + ' min read · Updated ' + a.last_updated + '</div>' +
          '<div class="body">' + renderMarkdown(a.body_md) + '</div>' +
          sourcesHtml +
        '</article>';

    // update the document title so the browser tab and back/forward
    // history show the actual article title
    document.title = a.title + ' - Scraptronic';
}


function getSlugFromUrl() {
    var query = window.location.search;
    if (!query) return null;
    var pairs = query.replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
        var kv = pairs[i].split('=');
        if (kv[0] === 'slug') return decodeURIComponent(kv[1] || '');
    }
    return null;
}


function showArticleNotFound(slug) {
    document.getElementById('article-host').innerHTML =
        '<div class="loading">' +
          '<p>Article not found' + (slug ? ' (' + escapeHtml(slug) + ')' : '') + '.</p>' +
          '<p><a href="learn.html">Back to the Learn index</a></p>' +
        '</div>';
}


function initArticle() {
    var slug = getSlugFromUrl();
    if (!slug) {
        showArticleNotFound(null);
        return;
    }

    // try the backend's per-slug endpoint first
    fetch(BACKEND_URL + '/api/articles/' + encodeURIComponent(slug))
        .then(function(resp) {
            if (resp.status === 404) throw new Error('not_found');
            if (!resp.ok) throw new Error('backend_error');
            return resp.json();
        })
        .then(renderArticle)
        .catch(function(err) {
            if (err.message === 'not_found') {
                showArticleNotFound(slug);
                return;
            }
            // backend unreachable - pull the full articles file and search it
            console.warn('article endpoint failed, falling back to static');
            fetch('data/articles.json')
                .then(function(resp) { return resp.json(); })
                .then(function(articles) {
                    for (var i = 0; i < articles.length; i++) {
                        if (articles[i].slug === slug) {
                            renderArticle(articles[i]);
                            return;
                        }
                    }
                    showArticleNotFound(slug);
                })
                .catch(function(err2) {
                    console.error('fallback also failed:', err2);
                    showArticleNotFound(slug);
                });
        });
}


// ---------- bootstrap ----------

function init() {
    if (document.getElementById('article-grid')) {
        initIndex();
    } else if (document.getElementById('article-host')) {
        initArticle();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
