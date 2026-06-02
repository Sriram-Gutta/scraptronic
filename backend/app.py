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


# same idea for the materials list
MATERIALS = []
MATERIALS_BY_SLUG = {}

def load_materials():
    global MATERIALS, MATERIALS_BY_SLUG
    path = os.path.join(DATA_DIR, "materials.json")
    try:
        with open(path) as f:
            MATERIALS = json.load(f)
        MATERIALS_BY_SLUG = {m["slug"]: m for m in MATERIALS}
        print(f"loaded {len(MATERIALS)} materials from {path}")
    except FileNotFoundError:
        print(f"WARN: {path} not found - /api/materials will return empty")

load_materials()


# and the articles
ARTICLES = []
ARTICLES_BY_SLUG = {}

def load_articles():
    global ARTICLES, ARTICLES_BY_SLUG
    path = os.path.join(DATA_DIR, "articles.json")
    try:
        with open(path) as f:
            ARTICLES = json.load(f)
        ARTICLES_BY_SLUG = {a["slug"]: a for a in ARTICLES}
        print(f"loaded {len(ARTICLES)} articles from {path}")
    except FileNotFoundError:
        print(f"WARN: {path} not found - /api/articles will return empty")

load_articles()


# basic healthcheck so we can confirm the api is up
@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "recyclers_loaded": len(RECYCLERS),
        "materials_loaded": len(MATERIALS),
        "articles_loaded": len(ARTICLES),
    })


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


# return all materials
@app.route("/api/materials")
def list_materials():
    return jsonify(MATERIALS)


# return one material by slug
@app.route("/api/materials/<slug>")
def get_material(slug):
    m = MATERIALS_BY_SLUG.get(slug)
    if m is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(m)


# given a material slug and pounds, return an estimated scrap value range
@app.route("/api/materials/estimate", methods=["POST"])
def estimate_value():
    body = request.get_json(silent=True) or {}
    slug = body.get("material", "").strip().lower()
    lbs = body.get("lbs")

    # validate slug
    m = MATERIALS_BY_SLUG.get(slug)
    if m is None:
        return jsonify({"error": "unknown material", "material": slug}), 400

    # validate lbs - must be a non-negative number
    if not isinstance(lbs, (int, float)) or isinstance(lbs, bool):
        return jsonify({"error": "lbs must be a number"}), 400
    if lbs < 0:
        return jsonify({"error": "lbs must be non-negative"}), 400

    # some materials don't have a per-lb price (like gold_from_boards which is
    # informational). bail out with a clear message.
    price = m.get("est_price_usd_per_lb")
    if price is None:
        return jsonify({
            "error": "no per-pound estimate available for this material",
            "material": slug,
            "note": "see the material description for how value is calculated",
        }), 422

    low = m.get("price_range_low", price)
    high = m.get("price_range_high", price)

    estimate = round(price * lbs, 2)
    low_estimate = round(low * lbs, 2)
    high_estimate = round(high * lbs, 2)

    return jsonify({
        "material": slug,
        "material_name": m["name"],
        "lbs": lbs,
        "estimated_value_usd": estimate,
        "low": low_estimate,
        "high": high_estimate,
        "unit_price_usd_per_lb": price,
        "note": "Estimates are based on regional scrap averages; actual payouts vary by recycler and load size.",
    })


# return all articles (without the full body_md, to keep the index payload small)
@app.route("/api/articles")
def list_articles():
    summary = []
    for a in ARTICLES:
        summary.append({
            "slug": a["slug"],
            "title": a["title"],
            "preview": a["preview"],
            "reading_time_min": a["reading_time_min"],
            "last_updated": a["last_updated"],
        })
    return jsonify(summary)


# return one article by slug (with the full body_md and sources)
@app.route("/api/articles/<slug>")
def get_article(slug):
    a = ARTICLES_BY_SLUG.get(slug)
    if a is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(a)


if __name__ == "__main__":
    # for local development only
    app.run(host="127.0.0.1", port=5000, debug=True)
