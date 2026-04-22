from pydantic import BaseModel
from typing import Optional
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
