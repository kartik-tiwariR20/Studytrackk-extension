"""
StayAwake backend — a small local Flask API the extension's service
worker pings to log study sessions and drowsiness events.

This is intentionally optional. All real-time detection happens fully
client-side in the extension (offscreen document); the extension keeps
working, alarm and all, with this backend turned off. What this adds:
durable history across browser restarts/reinstalls, and a place to build
a stats dashboard beyond what chrome.storage.local can show.

Run it locally:
    pip install -r requirements.txt
    python app.py
Listens on http://127.0.0.1:5000 by default, matching background.js.
"""

import sqlite3
from contextlib import closing
from datetime import datetime, date
from pathlib import Path

from flask import Flask, g, jsonify, request
from flask_cors import CORS

DB_PATH = Path(__file__).parent / "stayawake.db"

app = Flask(__name__)
# Extension pages are served from a chrome-extension:// origin, so CORS
# has to be opened up explicitly for the local dev/loopback case.
CORS(app, resources={r"/api/*": {"origins": "*"}})


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with closing(sqlite3.connect(DB_PATH)) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                ear_avg REAL,
                ts INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        db.commit()


@app.route("/api/events", methods=["POST"])
def log_event():
    payload = request.get_json(force=True, silent=True) or {}
    event_type = payload.get("type")
    if event_type not in {"session_start", "session_stop", "drowsy_alert"}:
        return jsonify({"error": "invalid event type"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO events (type, ear_avg, ts) VALUES (?, ?, ?)",
        (event_type, payload.get("earAvg"), payload.get("ts", 0)),
    )
    db.commit()
    return jsonify({"ok": True}), 201


@app.route("/api/stats", methods=["GET"])
def get_stats():
    db = get_db()
    today_start = int(
        datetime.combine(date.today(), datetime.min.time()).timestamp() * 1000
    )

    sessions_today = db.execute(
        "SELECT COUNT(*) AS c FROM events WHERE type = 'session_start' AND ts >= ?",
        (today_start,),
    ).fetchone()["c"]

    drowsy_alerts_today = db.execute(
        "SELECT COUNT(*) AS c FROM events WHERE type = 'drowsy_alert' AND ts >= ?",
        (today_start,),
    ).fetchone()["c"]

    total_sessions = db.execute(
        "SELECT COUNT(*) AS c FROM events WHERE type = 'session_start'"
    ).fetchone()["c"]

    total_drowsy_alerts = db.execute(
        "SELECT COUNT(*) AS c FROM events WHERE type = 'drowsy_alert'"
    ).fetchone()["c"]

    return jsonify(
        {
            "sessionsToday": sessions_today,
            "drowsyAlertsToday": drowsy_alerts_today,
            "totalSessions": total_sessions,
            "totalDrowsyAlerts": total_drowsy_alerts,
        }
    )


@app.route("/api/events/recent", methods=["GET"])
def recent_events():
    limit = min(int(request.args.get("limit", 50)), 200)
    db = get_db()
    rows = db.execute(
        "SELECT type, ear_avg, ts, created_at FROM events ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
