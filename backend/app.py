# scraptronic backend
# small flask api that serves recycler/material/article data and does
# a few simple computations (estimates, distance filters)
#
# run locally:  python app.py
# deployed on PythonAnywhere free tier - see ../README.md

import json
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# only let our github pages site call us in production
# (and any localhost for development)
CORS(app, origins=[
    "https://sriram-gutta.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
])


# figure out where the data folder lives - it's a sibling of /backend
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(HERE), "data")


# load the recycler list once at startup so we don't re-read the file
# every request. small enough to fit comfortably in memory.
RECYCLERS = []
RECYCLERS_BY_ID = {}

def load_recyclers():
    global RECYCLERS, RECYCLERS_BY_ID
    path = os.path.join(DATA_DIR, "recyclers.json")
    try:
        with open(path) as f:
            RECYCLERS = json.load(f)
        RECYCLERS_BY_ID = {r["id"]: r for r in RECYCLERS}
        print(f"loaded {len(RECYCLERS)} recyclers from {path}")
    except FileNotFoundError:
        print(f"WARN: {path} not found - /api/recyclers will return empty")

load_recyclers()


# basic healthcheck so we can confirm the api is up
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "recyclers_loaded": len(RECYCLERS)})


# return all recyclers, with optional ?material= filter
@app.route("/api/recyclers")
def list_recyclers():
    material = request.args.get("material", "").strip().lower()

    if not material:
        # no filter, send everything
        return jsonify(RECYCLERS)

    # filter to only the ones that accept the requested material
    filtered = []
    for r in RECYCLERS:
        if material in r.get("accepted_materials", []):
            filtered.append(r)
    return jsonify(filtered)


# return one recycler by id
@app.route("/api/recyclers/<recycler_id>")
def get_recycler(recycler_id):
    r = RECYCLERS_BY_ID.get(recycler_id)
    if r is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(r)


# more endpoints get added in the next sessions:
#   /api/materials, /api/materials/<slug>, /api/materials/estimate (POST)
#   /api/articles, /api/articles/<slug>


if __name__ == "__main__":
    # for local development only
    app.run(host="127.0.0.1", port=5000, debug=True)
