// scraptronic config - where to find the backend
// (swap the PROD url once you've set up your PythonAnywhere account)

var BACKEND_URL;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // running the frontend locally with python -m http.server
    BACKEND_URL = 'http://127.0.0.1:5000';
} else {
    // production - GitHub Pages talking to PythonAnywhere
    // TODO: replace with your actual PythonAnywhere subdomain
    BACKEND_URL = 'https://sriramgutta.pythonanywhere.com';
}
