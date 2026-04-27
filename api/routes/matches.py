"""
Match endpoints — serve parsed match data from store (per authenticated user).
No mock data is returned to authenticated users.
"""
from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException, Request
from models import (
    MatchOut, MatchSummary, GenerateRequest, GenerateResponse, JobStatus,
    RenderPlanRequest, RenderPlan, HighlightPlan, VideoFormat, Orientation,
)

router = APIRouter(prefix="/matches", tags=["matches"])

# Sincronizado com editor/src/theme.ts e editor/src/compositions/{reel,recap}.
# Source of truth ainda é o TS — Python espelha. Quando trocar lá, trocar aqui.
_REEL_INTRO_SEC = 2.0
_REEL_OUTRO_SEC = 2.5
_REEL_BOUNDS = (3.0, 7.0)
_RECAP_INTRO_SEC = 4.0
_RECAP_TIMELINE_SEC = 12.0
_RECAP_OUTRO_SEC = 3.0
_RECAP_BOUNDS = (4.0, 10.0)
_DIMS = {
    "vertical": (1080, 1920),
    "horizontal": (1920, 1080),
}


def _clamp_sec(raw: float, bounds: tuple[float, float]) -> float:
    lo, hi = bounds
    if raw <= 0 or raw != raw:  # raw != raw → NaN
        return lo
    return max(lo, min(hi, raw))


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


@router.post("/{match_id}/render-plan", response_model=RenderPlan)
def render_plan(match_id: str, body: RenderPlanRequest, request: Request) -> RenderPlan:
    """Preview de duração antes do user assistir o ad e disparar o render real.
    Espelha exatamente o cálculo do editor (calcReelDurationFromHighlights /
    calcRecapDurationFromHighlights) — se divergir, o user vê surpresa."""
    if not body.highlight_ranks:
        raise HTTPException(status_code=422, detail="Select at least one highlight")

    st = _get_store()
    if not st:
        raise HTTPException(status_code=503, detail="Storage indisponível")
    doc = st.load_match(match_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Match not found")

    match_out = _to_match_out(doc)
    selected = sorted(
        [h for h in match_out.highlights if h.rank in body.highlight_ranks],
        key=lambda h: h.rank,
    )
    if not selected:
        raise HTTPException(
            status_code=422,
            detail=f"Nenhum highlight com rank em {body.highlight_ranks}",
        )

    fmt = body.format
    is_recap = fmt == VideoFormat.recap
    is_card = fmt == VideoFormat.card
    bounds = _RECAP_BOUNDS if is_recap else _REEL_BOUNDS

    # Card é um still, não tem timeline de cenas — devolvemos plan especial.
    if is_card:
        # Card sempre vertical (mesma regra do generate).
        w, h = _DIMS["vertical"]
        return RenderPlan(
            format=fmt,
            orientation=Orientation.vertical,
            intro_sec=0.0,
            timeline_sec=0.0,
            outro_sec=0.0,
            highlights=[],
            total_sec=0.0,  # PNG estático
            width=w,
            height=h,
        )

    plan_highlights = [
        HighlightPlan(
            rank=h.rank,
            label=h.label,
            duration_sec=_clamp_sec(h.end - h.start, bounds),
        )
        for h in selected
    ]

    intro = _RECAP_INTRO_SEC if is_recap else _REEL_INTRO_SEC
    outro = _RECAP_OUTRO_SEC if is_recap else _REEL_OUTRO_SEC
    timeline = _RECAP_TIMELINE_SEC if is_recap else 0.0
    total = intro + timeline + sum(p.duration_sec for p in plan_highlights) + outro

    w, h = _DIMS[body.orientation.value]

    return RenderPlan(
        format=fmt,
        orientation=body.orientation,
        intro_sec=intro,
        timeline_sec=timeline,
        outro_sec=outro,
        highlights=plan_highlights,
        total_sec=round(total, 2),
        width=w,
        height=h,
    )


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

    # Player name: precedence pra `spec_player "<name>"` no client capture:
    #   1. Body explícito (override manual)
    #   2. parsed.player_name salvo no match_doc (v0.3.0-beta-3, Bug #11 fix)
    #   3. Fallback "player" (placeholder, NÃO mais (steamid)[-6:] que era
    #      "607343" e nunca batia com nome in-game CS2 → Bug #11 root cause)
    #
    # CS2 (Source 2) NÃO tem `spec_player_by_accountid` — só aceita o nome
    # in-game string. Sem name correto, capture_script.py emite só
    # `spec_mode 1` SEM `spec_player`, câmera vira free-cam autodirector.
    player_name = (
        body.player_name
        or doc.get("player_name")
        or "player"
    )

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

    # v0.3.1 (Sprint A5): estimativa scenario-aware baseada em duração real
    # de captura ao invés de hardcode "reel=90s sempre".
    #
    # Modelo wall-clock (calibrado com ~5 renders no PC):
    #   captura HLAE: ~real-time (60fps), com 50% overhead (mode switches +
    #     spec_player + freezetime navigation)
    #   ProRes encode per take: ~8s constante (fixed overhead per segment)
    #   ffmpeg concat + setup: ~30s constante (vendor binaries + I/O)
    #
    # Pra reel (vídeo editado): adiciona Remotion render (~30s base + 1s/seg).
    # Pra card (estático): só Remotion render (~15s).
    #
    # Heurística calibrada com smoke test rerun-2 do PC: 3 segments totais
    # 76s captura → MP4 final em ~12min wall-clock. Modelo predit: 76*1.5 +
    # 4*8 + 30 = 176s (2.9min) — bem abaixo do real, indica overhead de HLAE
    # injection + CS2 boot é maior. Adicionei +180s baseline pra cobrir.
    #
    # TODO (telemetria real): instrumentar logs do render_coordinator com
    # stage timings + recalibrar. Hoje é estimate, não medida.
    sum_segment_durations_s = 0  # TODO: vem do props ou highlight_ranks lookup
    n_segments = len(body.highlight_ranks)
    if body.format.value == "card":
        estimated = 15
    elif body.format.value == "reel":
        # ~real-time captura + per-segment overhead + Remotion + boot
        # Conservative pra não criar expectativa "vai em 90s" que vira "demorou 5min"
        estimated = 60 + (n_segments * 60) + 180  # 60s base + 60s/segment + 3min boot
    else:  # recap
        estimated = 90 + (n_segments * 60) + 180
    # Cap inferior pra não mostrar "10s" em casos de 1 highlight
    estimated = max(estimated, 120)

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
        # v0.3.1 (A3): game mode robusto. None pra demos legacy.
        game_mode=doc.get("game_mode"),
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
                # v0.3.2 Fase 1.23 — narrative context propagation. Pydantic
                # serializa None → null se field não estava no doc legacy
                # (highlights pré-v0.3.2). Editor faz fallback.
                time=k.get("time"),
                attacker_health=k.get("attacker_health"),
                alive_ct_after=k.get("alive_ct_after"),
                alive_t_after=k.get("alive_t_after"),
            )
            for k in h.get("kills", [])
        ]
        highlights.append(HighlightOut(
            rank=h["rank"],
            round_num=h.get("round_num", 1),
            label=h.get("label", ""),
            # v0.3.1 (A4): forward narrative PT-BR
            narrative=h.get("narrative"),
            score=h.get("score", 0.0),
            start=h.get("start", 0.0),
            end=h.get("end", 0.0),
            kills=kills,
            clip_url=h.get("clip_url"),
            # ── v0.3.0-alpha — scoring v2 context ─────────────────────────────
            # Bug v0.3.0-beta: estes campos eram salvos pelo scorer no JSON
            # via demo.py, mas _to_match_out() não os repassava ao HighlightOut
            # → caíam nos defaults do Pydantic (None / False / []), bloqueando
            # badges na UI e clustering no client. Fix: forward explícito.
            clutch_situation=h.get("clutch_situation"),
            won_round=h.get("won_round", False),
            bomb_action=h.get("bomb_action"),
            is_round_winning_kill=h.get("is_round_winning_kill", False),
            kill_ticks=h.get("kill_ticks", []),
            kill_timestamps=h.get("kill_timestamps", []),
            # v0.3.0-beta-2 — bomb action tick (back-calc anim window in client)
            bomb_action_tick=h.get("bomb_action_tick"),
            bomb_action_timestamp=h.get("bomb_action_timestamp"),
        ))

    return MatchOut(
        id=doc["id"],
        map=doc.get("map", "unknown"),
        date=doc.get("date", "—"),
        score=doc.get("score", "0–0"),
        side=doc.get("side", "ct"),
        status=doc.get("status", "parsed"),
        # v0.3.0-beta-3 (Bug #11): expose in-game player_name pra web preferir
        # ao Steam display name no payload do /render local.
        player_name=doc.get("player_name"),
        # v0.3.1 (A3): game mode robusto.
        game_mode=doc.get("game_mode"),
        stats=stats,
        highlights=highlights,
    )
