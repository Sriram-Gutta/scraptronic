// scraptronic config - where to find the backend

var BACKEND_URL;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // running the frontend locally with python -m http.server
    BACKEND_URL = 'http://127.0.0.1:5000';
} else {
    // production - GitHub Pages talking to PythonAnywhere
    BACKEND_URL = 'https://sriramgutta.pythonanywhere.com';
}
