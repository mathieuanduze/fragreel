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


@router.post("/analyze")
@router.post("/upload")  # legacy alias — do modelo auto-fila anterior
async def upload_demo(
    file: UploadFile = File(...),
    steamid: str = "",
    include_events: bool = False,
):
    """
    Receive a CS2 .dem file, parse it, and return highlight summary.
    Only the .dem is needed — the companion .info file is CS2 UI metadata only.

    Sprint I.4 (28/04, validation cross-check): query param `include_events=true`
    faz a resposta incluir os eventos parseados (kills, rounds, bomb_events) no
    schema esperado por fragreel.gg/api/score (TS scorer). Cliente usa esses
    events pra fazer cross-check em paralelo do scoring Python (Railway) vs TS
    (Vercel) e detectar divergências em produção real.

    Default false — não inflaciona resposta de produção. Cliente opt-in via
    env var FRAGREEL_API_CROSS_CHECK.
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
            # v0.3.0-beta-3 (Bug #11 fix): in-game name extraído do parser.
            # Cliente usa pra `spec_player "<name>"` no capture.cfg. Sem isso,
            # capture_script cai num elif que emite só `spec_mode 1`, câmera
            # vira free-cam autodirector. Pode ser None pra demos antigas
            # parseadas pré-v0.3.0-beta-3 — matches.py tem fallback que pelo
            # menos não envia (steamid)[-6:] como antes.
            "player_name":      parsed.player_name,
            # v0.3.1 (Sprint A3): game mode detection robusto via server_cvar.
            # Substitui heurística por round_count do web que errava em
            # casos edge (Premier 13-5 mostrava como Wingman).
            # Valores: "premier" | "competitive" | "wingman" | "casual" |
            #          "deathmatch" | "scrimmage" | None
            "game_mode":        parsed.game_mode,
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
                    # v0.3.1 (A4): resumo PT-BR
                    "narrative": h.narrative,
                    "score":     h.score,
                    "start":     h.start,
                    "end":       h.end,
                    "kills": [
                        {
                            "label":    k.label,
                            "weapon":   k.weapon,
                            "headshot": k.headshot,
                            "hp":       k.hp,
                            # v0.3.2 Fase 1.23 — narrative context (nullable
                            # pra highlights legados que não tinham os fields).
                            "time":            k.time,
                            "attacker_health": k.attacker_health,
                            "alive_ct_after":  k.alive_ct_after,
                            "alive_t_after":   k.alive_t_after,
                        }
                        for k in h.kills
                    ],
                    # v0.3.0-alpha — scoring v2 context (nullable / default-false)
                    "clutch_situation":      h.clutch_situation,
                    "won_round":             h.won_round,
                    "bomb_action":           h.bomb_action,
                    "is_round_winning_kill": h.is_round_winning_kill,
                    # v0.3.0-alpha — payload pro capture_script clusterizar
                    "kill_ticks":            h.kill_ticks,
                    "kill_timestamps":       h.kill_timestamps,
                    # v0.3.2 Round 4c Fase 1.27 — alive timeline pra counter ao vivo
                    "alive_timeline": [
                        {"time": ev.time, "alive_ct": ev.alive_ct, "alive_t": ev.alive_t}
                        for ev in (h.alive_timeline or [])
                    ],
                    # v0.3.0-beta-2 — bomb event tick (None se não tem bomb action)
                    # 3º elo dropping da cadeia que escapou no commit 6334960:
                    # scorer popula → Highlight tem (após c1ca4c6) → demo.py
                    # esquece de incluir no match_doc → store salva sem → matches.py
                    # carrega null → cluster_round_kills_v2 fallback → defuse/plant
                    # truncados. PC smoke test pegou em 25/04 madrugada-3.
                    "bomb_action_tick":      h.bomb_action_tick,
                    "bomb_action_timestamp": h.bomb_action_timestamp,
                }
                for h in highlights
            ],
        }

        save_match(match_id, match_doc)
        log.info(f"Match {match_id} parsed: {len(highlights)} highlights")

        response: dict = {
            "status":     "parsed",
            "match_id":   match_id,
            "map":        parsed.map_name,
            "kills":      total_kills,
            "highlights": len(highlights),
        }

        # Sprint I.4 — cross-check support: cliente passa ?include_events=true
        # quando opt-in via FRAGREEL_API_CROSS_CHECK env var. Adiciona events
        # parseados no schema do /api/score TS (KillEvent, RoundState, BombEvent)
        # pra cliente comparar Python scoring vs TS scoring em paralelo.
        if include_events:
            response["events"] = {
                "kills": [
                    {
                        "tick": k.tick,
                        "timestamp": k.timestamp,
                        "round_num": k.round_num,
                        "weapon": k.weapon,
                        "headshot": k.headshot,
                        "attacker_steamid": k.attacker_steamid or "",
                        "victim_steamid": k.victim_steamid or "",
                        "attacker_team": k.attacker_team,
                        "victim_team": k.victim_team,
                        "noscope": getattr(k, "noscope", False),
                        "thrusmoke": getattr(k, "thrusmoke", False),
                        "penetrated": getattr(k, "penetrated", 0),
                        "attackerblind": getattr(k, "attackerblind", False),
                        "attackerinair": getattr(k, "attackerinair", False),
                        "distance": getattr(k, "distance", None),
                        "attacker_health": getattr(k, "attacker_health", None),
                    }
                    for k in parsed.all_kills
                ],
                "rounds": [
                    {
                        "round_num": rn,
                        "winner_team": rs.winner_team,
                        "bomb_planted_by": rs.bomb_planted_by,
                        "bomb_defused_by": rs.bomb_defused_by,
                        "user_team": rs.user_team,
                        "user_won": bool(rs.user_won),
                    }
                    for rn, rs in parsed.round_states.items()
                ],
                "bomb_events": [
                    {
                        "tick": be.tick,
                        "timestamp": be.timestamp,
                        "round_num": be.round_num,
                        "player_steamid": be.player_steamid,
                        "action": be.action,
                    }
                    for be in parsed.bomb_events
                ],
            }
            response["demo_meta"] = {
                "map": parsed.map_name,
                "tickrate": parsed.tickrate,
                "match_id": match_id,
            }
            response["player_steamid"] = parsed.player_steamid or steamid
            log.info(
                f"Match {match_id}: include_events=True → response inclui "
                f"{len(response['events']['kills'])} kills, "
                f"{len(response['events']['rounds'])} rounds, "
                f"{len(response['events']['bomb_events'])} bomb_events"
            )

        return response

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
