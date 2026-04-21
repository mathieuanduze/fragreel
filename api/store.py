"""
Simple JSON file store for parsed match results.

Each match is stored as a JSON file at data/matches/<match_id>.json.
No database required for MVP.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

log = logging.getLogger("fragreel.store")

STORE_DIR = Path(__file__).parent.parent / "data" / "matches"
STORE_DIR.mkdir(parents=True, exist_ok=True)


def save_match(match_id: str, data: dict) -> None:
    path = STORE_DIR / f"{match_id}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    log.info(f"Saved match: {match_id}")


def load_match(match_id: str) -> dict | None:
    path = STORE_DIR / f"{match_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception as e:
        log.error(f"Failed to load match {match_id}: {e}")
        return None


def list_matches(steamid: str | None = None, limit: int = 50) -> list[dict]:
    """Return stored matches, optionally filtered by steamid, sorted by most recently modified."""
    results = []
    files = sorted(STORE_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    for f in files:
        if len(results) >= limit:
            break
        try:
            doc = json.loads(f.read_text())
            if steamid and doc.get("steamid") != steamid:
                continue
            results.append(doc)
        except Exception:
            continue
    return results


def match_exists(match_id: str) -> bool:
    return (STORE_DIR / f"{match_id}.json").exists()
