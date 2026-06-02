# scraptronic backend
# small flask api that serves recycler/material/article data and does
# a few simple computations (estimates, distance filters)
#
# run locally:  python app.py
# deployed on PythonAnywhere free tier - see ../README.md

from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

# only let our github pages site call us in production
# (and any localhost for development)
CORS(app, origins=[
    "https://sriram-gutta.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
])


# basic healthcheck so we can confirm the api is up
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# more endpoints get added in the next sessions:
#   /api/recyclers, /api/recyclers/<id>
#   /api/materials, /api/materials/<slug>, /api/materials/estimate (POST)
#   /api/articles, /api/articles/<slug>


if __name__ == "__main__":
    # for local development only
    app.run(host="127.0.0.1", port=5000, debug=True)
