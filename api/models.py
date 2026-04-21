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


class GenerateRequest(BaseModel):
    format: VideoFormat
    highlight_ranks: list[int]
    mood: Mood = Mood.acao
    player_name: Optional[str] = None


class GenerateResponse(BaseModel):
    job_id: str
    status: JobStatus
    estimated_seconds: int
    message: str
    render_url: Optional[str] = None  # URL para baixar quando render terminar
    status_url: Optional[str] = None  # URL para polling de status
