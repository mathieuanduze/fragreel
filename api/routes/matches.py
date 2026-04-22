"""
Match endpoints — serve parsed match data from store (per authenticated user).
No mock data is returned to authenticated users.
"""
from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException, Request
from models import MatchOut, MatchSummary, GenerateRequest, GenerateResponse, JobStatus

router = APIRouter(prefix="/matches", tags=["matches"])


def _get_store():
    try:
        import store
        return store
    except Exception:
        return None


def _steamid_from_request(request: Request) -> str | None:
    """Extract steamid from Bearer JWT, or None if unauthenticated."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        from routes.auth import decode_jwt
        payload = decode_jwt(auth[7:])
        return payload.get("steamid")
    except Exception:
        return None


@router.get("", response_model=list[MatchSummary])
def list_matches(request: Request):
    steamid = _steamid_from_request(request)
    st = _get_store()
    if st:
        real = st.list_matches(steamid=steamid)
        if real:
            return [_to_summary(m) for m in real]
    # Return empty list — frontend shows the "no matches yet" empty state
    return []


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: str, request: Request):
    steamid = _steamid_from_request(request)
    st = _get_store()
    if st:
        doc = st.load_match(match_id)
        if doc:
            # Basic ownership check
            if steamid and doc.get("steamid") and doc["steamid"] != steamid:
                raise HTTPException(status_code=403, detail="Not your match")
            return _to_match_out(doc)
    raise HTTPException(status_code=404, detail="Match not found")


@router.post("/{match_id}/generate", response_model=GenerateResponse)
def generate_video(match_id: str, body: GenerateRequest, request: Request):
    if not body.highlight_ranks:
        raise HTTPException(status_code=422, detail="Select at least one highlight")

    # Carrega a partida para passar de props pro Remotion
    st = _get_store()
    if not st:
        raise HTTPException(status_code=503, detail="Storage indisponível")
    doc = st.load_match(match_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Match not found")

    match_out = _to_match_out(doc)

    # Player name: usa o fornecido, ou cai para steamid curto, ou "player"
    player_name = body.player_name or (doc.get("steamid") or "")[-6:] or "player"

    # Card é estático e sempre vertical (formato semântico do produto);
    # reel/recap respeitam a escolha do user.
    orientation = (
        "vertical" if body.format.value == "card" else body.orientation.value
    )

    # Monta as props exatamente como o ReelProps/CardProps do editor/src/types.ts
    props = {
        "match": match_out.model_dump(),
        "selectedRanks": body.highlight_ranks,
        "mood": body.mood.value,
        "playerName": player_name,
        "orientation": orientation,
    }

    # Dispara render em background
    from routes.renders import spawn_render
    job = spawn_render(match_id=match_id, fmt=body.format.value, props=props)

    # Estimativa (Railway CPU é ~10-15x slower que local)
    format_times = {"reel": 90, "recap": 180, "card": 15}
    estimated = format_times.get(body.format.value, 60)

    return GenerateResponse(
        job_id=job.job_id,
        status=JobStatus.pending,
        estimated_seconds=estimated,
        message=f"Gerando {body.format.value} com {len(body.highlight_ranks)} highlight(s). Aguarde o anúncio.",
        render_url=f"/renders/{match_id}/{body.format.value}",
        status_url=f"/renders/{match_id}/{body.format.value}/status",
    )


# ── Converters ─────────────────────────────────────────────────────────────────

def _to_summary(doc: dict) -> MatchSummary:
    return MatchSummary(
        id=doc["id"],
        map=doc.get("map", "unknown"),
        date=doc.get("date", "—"),
        score=doc.get("score", "0–0"),
        side=doc.get("side", "ct"),
        status=doc.get("status", "parsed"),
        highlights_count=doc.get("highlights_count", 0),
        top_play=doc.get("top_play", "—"),
        rating=doc.get("rating", "1.00"),
        kd=doc.get("kd", "0/0"),
    )


def _to_match_out(doc: dict) -> MatchOut:
    from models import MatchStats, HighlightOut, KillOut

    stats_raw = doc.get("stats", {})
    stats = MatchStats(
        kd=stats_raw.get("kd", "0/0"),
        hs=stats_raw.get("hs", "0%"),
        adr=stats_raw.get("adr", "0"),
        rating=stats_raw.get("rating", "1.00"),
    )

    highlights = []
    for h in doc.get("highlights", []):
        kills = [
            KillOut(
                label=k.get("label", ""),
                weapon=k.get("weapon", ""),
                headshot=k.get("headshot", False),
                hp=k.get("hp", 0),
            )
            for k in h.get("kills", [])
        ]
        highlights.append(HighlightOut(
            rank=h["rank"],
            round_num=h.get("round_num", 1),
            label=h.get("label", ""),
            score=h.get("score", 0.0),
            start=h.get("start", 0.0),
            end=h.get("end", 0.0),
            kills=kills,
            clip_url=h.get("clip_url"),
        ))

    return MatchOut(
        id=doc["id"],
        map=doc.get("map", "unknown"),
        date=doc.get("date", "—"),
        score=doc.get("score", "0–0"),
        side=doc.get("side", "ct"),
        status=doc.get("status", "parsed"),
        stats=stats,
        highlights=highlights,
    )
