# Scraptronic

> A platform that helps you find local e-waste recyclers, see what your old electronics are worth in raw materials, and track the impact of recycling them. San Diego focused. Built around public data.

🌐 **Live demo (frontend):** https://sriram-gutta.github.io/scraptronic/
🔌 **API health check:** _coming soon — will be hosted on PythonAnywhere_

---

## What's here right now (v0 — Session 1 skeleton)

This is the first deployable cut. It's intentionally bare so the structure is visible:

- **6 frontend pages** (Home, Map, Materials, My Recycling, Learn, About) with the shared nav + footer in place. Map/Materials/Tracker/Learn currently show "Coming in the next build" placeholders that describe what each page will become.
- **Flask backend** with a single `/api/health` endpoint, ready to deploy on PythonAnywhere's free tier.
- **CORS configured** for `https://sriram-gutta.github.io` plus `localhost` so dev works without surprises.
- **Repo layout** for the data files (`recyclers.json`, `materials.json`, `articles.json`) that get filled in over the next few sessions.

## Planned full feature set

- **Recycler map** — ~18 hand-curated e-waste drop-offs in San Diego, sourced from CalRecycle, City of San Diego ESD, and EPA SMM listings. Leaflet + OpenStreetMap.
- **Materials & value calculator** — common e-waste materials (aluminum, copper, circuit boards, etc.) with estimated regional scrap prices from ScrapMonster. Punch in pounds, get a $ estimate.
- **My Recycling tracker** — log entries, see running totals, tier progress, and estimated CO₂ saved (using EPA WARM factors). All in `localStorage` — no signup.
- **Learn** — short articles on the e-waste problem, prep tips, what's actually inside your old laptop. Every claim cited.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla HTML + CSS + JS + [Leaflet](https://leafletjs.com/) | No build step, easy to read, easy to host. |
| Backend | Python [Flask](https://flask.palletsprojects.com/) | Familiar from my Data Mine / Pandas work. Simple enough to fit in one file. |
| Hosting | GitHub Pages (frontend) + PythonAnywhere (backend) | Both free tiers, both always-on (no cold starts). |
| Data | Hand-curated JSON files in `/data` | Single source of truth; small enough to commit; no DB to maintain. |
| User state | Browser `localStorage` | No auth → no DB → fits the free hosting story. |

## Repo layout

```
scraptronic/
├── frontend/                # static site → GitHub Pages
│   ├── index.html, map.html, materials.html, tracker.html, learn.html, about.html
│   ├── css/style.css
│   └── js/config.js         # points at the backend; localhost in dev, PythonAnywhere in prod
├── backend/                 # Flask api → PythonAnywhere
│   ├── app.py               # all routes, top to bottom
│   ├── wsgi.py              # PythonAnywhere entry point
│   └── requirements.txt
├── data/                    # JSON gets added here over the next sessions
├── LICENSE
└── README.md
```

## Running locally

**Frontend** (serves the static files on port 8000):

```bash
cd frontend
python3 -m http.server 8000
# then open http://127.0.0.1:8000/
```

**Backend** (Flask dev server on port 5000):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py
# then check http://127.0.0.1:5000/api/health
```

The frontend's `js/config.js` automatically points at `127.0.0.1:5000` when you load it from localhost, so the two halves talk to each other without any setup.

## Honest about this demo

A few things up front so nobody has to ask:

- **Scrap prices are estimates** sourced from public regional averages (ScrapMonster, iScrap App). Actual payouts vary by recycler, load size, and the day.
- **Users get paid by the recyclers themselves**, not by this site. A production version of Scraptronic would partner with recyclers to facilitate payouts and take a transaction fee; this version focuses on discovery, education, and progress tracking.
- **Recycler hours and contact info go stale.** Each entry will carry the date it was last verified, and the data file lives in the repo so anyone can submit a PR.

## What I'd build next (after Session 6)

- Real recycler partnerships with payout intermediation.
- User accounts (Postgres + JWT) so you can carry your history across devices.
- Drop-off scheduling, route optimization for businesses with bulk e-waste.
- Coverage beyond San Diego — California first, then nationwide.

## License

MIT — see [LICENSE](LICENSE).
