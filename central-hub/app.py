"""
Central hub (yucatanmx.com) - reference implementation.

Tracks every active town node announced through /api/heartbeat and answers
/nearest-town queries so frontends can perform live hand-offs between towns
without a page reload.

Storage: single SQLite file (central_hub.db). Run with:

    pip install -r requirements.txt
    uvicorn app:app --host 0.0.0.0 --port 8000
"""

import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).parent / "central_hub.db"
STALE_AFTER_SECONDS = 60 * 15  # nodes that haven't beat in 15 min are hidden

app = FastAPI(title="RTM Central Hub", version="1.0.0")


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS nodes (
            town_id       TEXT PRIMARY KEY,
            town_name     TEXT NOT NULL,
            latitude      REAL NOT NULL,
            longitude     REAL NOT NULL,
            app_type      TEXT NOT NULL DEFAULT 'transit',
            tunnel_url    TEXT,
            welcome_message TEXT,
            last_seen     TEXT NOT NULL,
            app_stats     TEXT NOT NULL DEFAULT '{}',
            system_info   TEXT NOT NULL DEFAULT '{}'
        )
        """
    )
    conn.commit()
    return conn


class Heartbeat(BaseModel):
    town_id: str = Field(..., max_length=120)
    town_name: str = Field(..., max_length=200)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    app_type: str = "transit"
    tunnel_url: str = ""
    welcome_message: str = ""
    app_stats: dict = {}
    system_info: dict = {}


class NearestTown(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    current_town: str = ""


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "rtm-central-hub"}


@app.post("/api/heartbeat")
async def heartbeat(body: Heartbeat, request: Request):
    now = datetime.now(timezone.utc).isoformat()
    tunnel_url = body.tunnel_url or str(request.base_url).rstrip("/")

    with db() as conn:
        conn.execute(
            """
            INSERT INTO nodes (town_id, town_name, latitude, longitude, app_type,
                               tunnel_url, welcome_message, last_seen, app_stats, system_info)
            VALUES (:town_id, :town_name, :latitude, :longitude, :app_type,
                    :tunnel_url, :welcome_message, :last_seen, :app_stats, :system_info)
            ON CONFLICT(town_id) DO UPDATE SET
                town_name=excluded.town_name,
                latitude=excluded.latitude,
                longitude=excluded.longitude,
                app_type=excluded.app_type,
                tunnel_url=excluded.tunnel_url,
                welcome_message=excluded.welcome_message,
                last_seen=excluded.last_seen,
                app_stats=excluded.app_stats,
                system_info=excluded.system_info
            """,
            {
                "town_id": body.town_id,
                "town_name": body.town_name,
                "latitude": body.latitude,
                "longitude": body.longitude,
                "app_type": body.app_type,
                "tunnel_url": tunnel_url,
                "welcome_message": body.welcome_message,
                "last_seen": now,
                "app_stats": __import__("json").dumps(body.app_stats),
                "system_info": __import__("json").dumps(body.system_info),
            },
        )

    return {"ok": True, "town_id": body.town_id, "last_seen": now}


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _active_nodes(conn):
    cutoff = datetime.now(timezone.utc).timestamp() - STALE_AFTER_SECONDS
    rows = conn.execute(
        "SELECT * FROM nodes WHERE last_seen != '' ORDER BY last_seen DESC"
    ).fetchall()

    nodes = []
    for row in rows:
        try:
            last = datetime.fromisoformat(row["last_seen"]).timestamp()
        except ValueError:
            continue
        if last >= cutoff:
            nodes.append(row)
    return nodes


@app.get("/api/towns")
async def towns():
    import json

    with db() as conn:
        result = []
        for row in _active_nodes(conn):
            result.append(
                {
                    "town_id": row["town_id"],
                    "town_name": row["town_name"],
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "app_type": row["app_type"],
                    "tunnel_url": row["tunnel_url"],
                    "welcome_message": row["welcome_message"],
                    "app_stats": json.loads(row["app_stats"]),
                }
            )
    return {"towns": result}


@app.post("/api/nearest-town")
async def nearest_town(body: NearestTown):
    with db() as conn:
        nodes = _active_nodes(conn)

    best = None
    best_distance = None
    for row in nodes:
        if row["town_id"] == body.current_town:
            continue
        distance = _haversine(body.latitude, body.longitude, row["latitude"], row["longitude"])
        if best is None or distance < best_distance:
            best = row
            best_distance = distance

    if best is None:
        return {"town": None}

    return {
        "town": {
            "town_id": best["town_id"],
            "town_name": best["town_name"],
            "latitude": best["latitude"],
            "longitude": best["longitude"],
            "app_type": best["app_type"],
            "tunnel_url": best["tunnel_url"],
            "welcome_message": best["welcome_message"],
            "max_bounds": None,
        }
    }
