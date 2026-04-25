from pydantic import BaseModel
from typing import Literal, Optional
from enum import Enum


class VideoFormat(str, Enum):
    reel = "reel"
    recap = "recap"
    card = "card"


class JobStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    error = "error"


class KillOut(BaseModel):
    label: str
    weapon: str
    headshot: bool
    hp: int
    # Tempo da kill em segundos (mesma base de HighlightOut.start/end).
    # Quando o parser CS2 não fornece, o editor estima distribuindo
    # uniformemente as kills entre highlight.start e highlight.end.
    time: Optional[float] = None


class HighlightOut(BaseModel):
    rank: int
    round_num: int = 1
    label: str
    score: float
    start: float
    end: float
    kills: list[KillOut]
    clip_url: Optional[str] = None   # URL do clipe de vídeo, se disponível
    # ── v0.3.0-alpha — scoring v2 context ─────────────────────────────────────
    # Web usa esses campos pra mostrar tags ("⚡ 1v3 Clutch", "💣 Defuse")
    # nos cards de pré-seleção. Todos opcionais → highlights antigos
    # (gerados antes do deploy v0.3) continuam válidos com defaults.
    clutch_situation: Optional[Literal["1v2", "1v3", "1v4", "1v5"]] = None
    won_round: bool = False
    bomb_action: Optional[Literal["defuse", "plant_won"]] = None
    is_round_winning_kill: bool = False
    # ── v0.3.0-alpha — payload pro client clusterizar a captura ────────────────
    # Server pontua por round inteiro (1 highlight = 1 round); cluster de
    # captura (gap=10s, pad=±5s/±3.5s) é responsabilidade do capture_script
    # no client (v0.3.0-beta). Estes campos viajam intactos do scorer.py
    # → capture_script, que decide quais ticks gravar dentro do round escolhido.
    # Defaults vazios mantêm compatibilidade com highlights legados.
    kill_ticks: list[int] = []           # ticks de cada kill do user no round
    kill_timestamps: list[float] = []    # mesmas kills em segundos do jogo
    # ── v0.3.0-beta-2 — bomb event tick para cluster_round_kills_v2 ───────────
    # Tick exato de COMPLETION da ação de bomba (planted/defused) feita pelo
    # PRÓPRIO USER. Permite que o client garanta cobertura inteira da animação
    # (plant 3.2s ou defuse 10s no-kit) na janela de captura, conforme regra
    # dura "defuse + plant inteiros" (Mathieu, 25/04/2026).
    # Server lê de ParsedDemo.bomb_events e popula só quando bomb_action está
    # set E foi pelo user. None pra highlights legados.
    bomb_action_tick: Optional[int] = None
    bomb_action_timestamp: Optional[float] = None


class MatchStats(BaseModel):
    kd: str
    hs: str
    adr: str
    rating: str


class MatchOut(BaseModel):
    id: str
    map: str
    date: str
    score: str
    side: str
    status: str
    stats: MatchStats
    highlights: list[HighlightOut]


class MatchSummary(BaseModel):
    id: str
    map: str
    date: str
    score: str
    side: str
    status: str
    highlights_count: int
    top_play: str
    rating: str
    kd: str


class Mood(str, Enum):
    eletronica = "eletronica"
    acao = "acao"
    heroico = "heroico"
    chill = "chill"


class Orientation(str, Enum):
    # vertical = 1080x1920 (TikTok / Reels / Shorts)
    # horizontal = 1920x1080 (YouTube / Twitch)
    vertical = "vertical"
    horizontal = "horizontal"


class GenerateRequest(BaseModel):
    format: VideoFormat
    highlight_ranks: list[int]
    mood: Mood = Mood.acao
    player_name: Optional[str] = None
    # Default vertical mantém compatibilidade com clientes antigos que não
    # mandam o campo. Card sempre força vertical (formato semântico).
    orientation: Orientation = Orientation.vertical


class GenerateResponse(BaseModel):
    job_id: str
    status: JobStatus
    estimated_seconds: int
    message: str
    render_url: Optional[str] = None  # URL para baixar quando render terminar
    status_url: Optional[str] = None  # URL para polling de status


# ─── /render-plan ─────────────────────────────────────────────────────────────
# Endpoint de "preview" — recebe a mesma seleção do /generate mas, em vez de
# disparar render, devolve breakdown de duração (intro + cada highlight + outro).
# Uso: web mostra "Seu vídeo terá ~32s · 5 cenas" antes do user assistir o ad.

class HighlightPlan(BaseModel):
    rank: int
    label: str
    duration_sec: float  # já clampada pelo bound do formato


class RenderPlanRequest(BaseModel):
    format: VideoFormat
    highlight_ranks: list[int]
    orientation: Orientation = Orientation.vertical


class RenderPlan(BaseModel):
    format: VideoFormat
    orientation: Orientation
    intro_sec: float
    timeline_sec: float = 0.0  # só recap usa timeline
    outro_sec: float
    highlights: list[HighlightPlan]
    total_sec: float
    width: int
    height: int
