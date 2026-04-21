"""
Demo upload endpoint.

Flow:
  1. Receive .dem file from browser (drag-and-drop) or Windows client
  2. Save to disk
  3. Persist a minimal "queued" record immediately (so the match is always
     findable even if parsing fails or demoparser2 is absent)
  4. Parse with demoparser2 (if available) → update the stored record
  5. Return status + highlight count
"""
from __future__ import annotations

import logging
import traceback
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

log = logging.getLogger("fragreel.demo")

router = APIRouter(prefix="/demo", tags=["demo"])

DEMO_DIR = Path(__file__).parent.parent.parent / "demos"
DEMO_DIR.mkdir(parents=True, exist_ok=True)

MAX_DEMO_BYTES = 500 * 1024 * 1024  # 500 MB guard


@router.post("/upload")
async def upload_demo(file: UploadFile = File(...), steamid: str = ""):
    """
    Receive a CS2 .dem file, parse it, and return highlight summary.
    Only the .dem is needed — the companion .info file is CS2 UI metadata only.
    """
    # ── Validate ───────────────────────────────────────────────────────────────
    if not file.filename or not file.filename.endswith(".dem"):
        raise HTTPException(status_code=422, detail="File must be a .dem")

    # ── Save to disk ───────────────────────────────────────────────────────────
    dest = DEMO_DIR / file.filename
    content = await file.read()

    if len(content) > MAX_DEMO_BYTES:
        raise HTTPException(status_code=413, detail="Demo too large (max 500 MB)")

    dest.write_bytes(content)
    match_id = dest.stem   # e.g. "match730_003abc" from "match730_003abc.dem"
    log.info(f"Demo saved: {dest.name} ({len(content) // 1024} KB) | steamid={steamid}")

    # ── Always persist a minimal queued record right away ──────────────────────
    # This guarantees GET /matches/{id} won't 404 even if parsing fails below.
    try:
        from store import save_match
        _save_queued(save_match, match_id, steamid)
    except Exception as e:
        log.warning(f"Could not persist queued record for {match_id}: {e}")

    # ── Parse ──────────────────────────────────────────────────────────────────
    try:
        from parser.demo_parser import parse
        from parser.scorer import score_kills
        from store import save_match

        parsed     = parse(dest, player_steamid=steamid or None)
        highlights = score_kills(parsed) if parsed.player_kills else []

        # ── Build full match document ──────────────────────────────────────────
        total_kills = len(parsed.player_kills)
        hs_kills    = sum(1 for k in parsed.player_kills if k.headshot)

        # Deaths: times the player was killed (victim in all_kills)
        player_deaths = sum(
            1 for k in parsed.all_kills
            if k.victim_steamid == parsed.player_steamid
        ) if parsed.player_steamid else (len(parsed.all_kills) - total_kills)

        # Rounds: prefer parsed score; fall back to max round_num seen in kills
        rounds_from_score = parsed.ct_score + parsed.t_score
        rounds_from_kills = max((k.round_num for k in parsed.all_kills), default=1)
        total_rounds      = max(rounds_from_score, rounds_from_kills, 1)

        adr_approx = round((total_kills * 100) / total_rounds, 1)
        kd_approx  = f"{total_kills}/{player_deaths}"

        match_doc = {
            # Identity
            "steamid":          steamid,
            # Summary fields (for list view)
            "id":               match_id,
            "map":              parsed.map_name,
            "date":             _today(),
            "score":            f"{parsed.ct_score}–{parsed.t_score}",
            "side":             "ct",
            "status":           "parsed",
            "highlights_count": len(highlights),
            "top_play":         highlights[0].label if highlights else "—",
            "rating":           _estimate_rating(total_kills, total_rounds),
            "kd":               kd_approx,
            # Detail fields (for match view)
            "stats": {
                "kd":     kd_approx,
                "hs":     f"{round(hs_kills / total_kills * 100)}%" if total_kills else "0%",
                "adr":    str(adr_approx),
                "rating": _estimate_rating(total_kills, total_rounds),
            },
            "highlights": [
                {
                    "rank":      h.rank,
                    "round_num": h.round_num,
                    "label":     h.label,
                    "score":     h.score,
                    "start":     h.start,
                    "end":       h.end,
                    "kills": [
                        {
                            "label":    k.label,
                            "weapon":   k.weapon,
                            "headshot": k.headshot,
                            "hp":       k.hp,
                        }
                        for k in h.kills
                    ],
                }
                for h in highlights
            ],
        }

        save_match(match_id, match_doc)
        log.info(f"Match {match_id} parsed: {len(highlights)} highlights")

        return {
            "status":     "parsed",
            "match_id":   match_id,
            "map":        parsed.map_name,
            "kills":      total_kills,
            "highlights": len(highlights),
        }

    except RuntimeError:
        # demoparser2 not installed — queued record already saved above
        log.warning("demoparser2 not available, demo queued")
        return {
            "status":   "queued",
            "match_id": match_id,
            "message":  "Demo recebida. Parser será executado quando demoparser2 estiver disponível.",
        }

    except FileNotFoundError as e:
        log.error(f"Demo file missing after save: {e}")
        raise HTTPException(status_code=500, detail="Demo save failed")

    except Exception as e:
        log.error(f"Parse error for {file.filename}: {type(e).__name__}: {e}\n{traceback.format_exc()}")
        # Queued record already saved — client can poll for status
        return {
            "status":   "queued",
            "match_id": match_id,
            "message":  f"Demo recebida mas não foi possível parsear ({type(e).__name__}). Será reprocessada.",
        }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _save_queued(save_fn, match_id: str, steamid: str) -> None:
    """Persist a minimal placeholder so the match is immediately discoverable."""
    save_fn(match_id, {
        "steamid":          steamid,
        "id":               match_id,
        "map":              "unknown",
        "date":             _today(),
        "score":            "—",
        "side":             "ct",
        "status":           "queued",
        "highlights_count": 0,
        "top_play":         "—",
        "rating":           "1.00",
        "kd":               "—",
        "stats":            {"kd": "—", "hs": "—", "adr": "—", "rating": "1.00"},
        "highlights":       [],
    })


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%-d de %b, %Y")


def _estimate_rating(kills: int, rounds: int) -> str:
    """Rough HLTV-style rating estimate from K/rounds."""
    if rounds == 0:
        return "1.00"
    kpr = kills / rounds
    r = 0.68 + 1.3 * kpr
    return f"{min(r, 2.5):.2f}"
