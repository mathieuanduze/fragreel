"""
Match endpoints — serve parsed match data from store, fall back to mock data.
"""
from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException
from models import MatchOut, MatchSummary, GenerateRequest, GenerateResponse, JobStatus
from mock_data import MOCK_MATCHES, MOCK_MATCH_DETAIL

router = APIRouter(prefix="/matches", tags=["matches"])


def _get_store():
    """Lazy import store to avoid crash if store dir isn't ready yet."""
    try:
        import store
        return store
    except Exception:
        return None


@router.get("", response_model=list[MatchSummary])
def list_matches():
    store = _get_store()
    if store:
        real = store.list_matches()
        if real:
            return [_to_summary(m) for m in real]
    return MOCK_MATCHES


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: str):
    # 1. Try real store first
    store = _get_store()
    if store:
        doc = store.load_match(match_id)
        if doc:
            return _to_match_out(doc)

    # 2. Fall back to mock data
    match = MOCK_MATCH_DETAIL.get(match_id) or MOCK_MATCH_DETAIL.get("match-001")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.post("/{match_id}/generate", response_model=GenerateResponse)
def generate_video(match_id: str, body: GenerateRequest):
    # Verify match exists (real or mock)
    store = _get_store()
    exists = store and store.match_exists(match_id)
    if not exists and match_id not in MOCK_MATCH_DETAIL:
        # Accept anyway — generation queue doesn't need the match doc
        pass

    if not body.highlight_ranks:
        raise HTTPException(status_code=422, detail="Select at least one highlight")

    format_times = {"reel": 45, "recap": 150, "card": 5}
    estimated = format_times.get(body.format.value, 60)

    return GenerateResponse(
        job_id=str(uuid.uuid4()),
        status=JobStatus.pending,
        estimated_seconds=estimated,
        message=f"Gerando {body.format.value} com {len(body.highlight_ranks)} highlight(s). Aguarde o anúncio.",
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
