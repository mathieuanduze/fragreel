"""
Render pipeline — orquestra o Remotion via subprocess.

/renders/{match_id}/{format}/status → {status: rendering|done|error, progress}
/renders/{match_id}/{format}        → streama o MP4/PNG final
"""
from __future__ import annotations

import json
import logging
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

log = logging.getLogger("fragreel.renders")

router = APIRouter(prefix="/renders", tags=["renders"])

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RENDERS_DIR = REPO_ROOT / "data" / "renders"
EDITOR_DIR = REPO_ROOT / "editor"
RENDERS_DIR.mkdir(parents=True, exist_ok=True)


# ─── Job state (em memória — suficiente pro MVP) ──────────────────────────────
class RenderJob(BaseModel):
    job_id: str
    match_id: str
    format: str
    status: str  # pending | rendering | done | error
    progress: float = 0.0
    path: Optional[str] = None
    error: Optional[str] = None
    started_at: float
    finished_at: Optional[float] = None


_jobs: dict[str, RenderJob] = {}
_jobs_by_key: dict[tuple[str, str], str] = {}  # (match_id, format) → job_id
_jobs_lock = threading.Lock()


def _format_config(fmt: str) -> tuple[str, str, str]:
    """Retorna (composition_id, subcommand, extension)."""
    if fmt == "reel":
        return "HighlightsReel", "render", "mp4"
    if fmt == "card":
        return "StoryCard", "still", "png"
    if fmt == "recap":
        # Fase 2 — por ora cai em reel mesmo
        return "HighlightsReel", "render", "mp4"
    raise ValueError(f"unknown format: {fmt}")


def _output_path(match_id: str, fmt: str) -> Path:
    _, _, ext = _format_config(fmt)
    out_dir = RENDERS_DIR / match_id
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / f"{fmt}.{ext}"


def _run_render(job_id: str, props: dict[str, Any]) -> None:
    """Executa o render do Remotion — chamado em thread de background."""
    job = _jobs[job_id]
    comp_id, subcmd, ext = _format_config(job.format)
    out_path = _output_path(job.match_id, job.format)

    cmd: list[str] = [
        "npx", "remotion", subcmd, comp_id, str(out_path),
        "--props", json.dumps(props),
        "--log=error",
    ]
    if subcmd == "still":
        cmd.extend(["--frame", "30"])

    log.info("[render %s] start · match=%s format=%s", job_id, job.match_id, job.format)
    with _jobs_lock:
        job.status = "rendering"

    try:
        result = subprocess.run(
            cmd,
            cwd=EDITOR_DIR,
            capture_output=True,
            text=True,
            timeout=600,  # 10min max
        )
        if result.returncode != 0:
            log.error("[render %s] failed: %s", job_id, result.stderr[-500:])
            with _jobs_lock:
                job.status = "error"
                job.error = result.stderr[-500:] or "subprocess falhou"
                job.finished_at = time.time()
            return

        log.info("[render %s] done · %s", job_id, out_path)
        with _jobs_lock:
            job.status = "done"
            job.progress = 1.0
            job.path = str(out_path)
            job.finished_at = time.time()
    except subprocess.TimeoutExpired:
        log.error("[render %s] timeout após 10min", job_id)
        with _jobs_lock:
            job.status = "error"
            job.error = "timeout após 10min"
            job.finished_at = time.time()
    except Exception as e:
        log.exception("[render %s] exception", job_id)
        with _jobs_lock:
            job.status = "error"
            job.error = str(e)
            job.finished_at = time.time()


def spawn_render(match_id: str, fmt: str, props: dict[str, Any]) -> RenderJob:
    """Cria job e dispara thread de render. Se já existe job em andamento pro par
    (match, format), retorna o existente em vez de criar outro."""
    key = (match_id, fmt)
    with _jobs_lock:
        existing_id = _jobs_by_key.get(key)
        if existing_id:
            existing = _jobs.get(existing_id)
            if existing and existing.status in ("pending", "rendering"):
                log.info("[render] reusing job %s for %s/%s", existing_id, match_id, fmt)
                return existing

        job_id = str(uuid.uuid4())
        job = RenderJob(
            job_id=job_id,
            match_id=match_id,
            format=fmt,
            status="pending",
            started_at=time.time(),
        )
        _jobs[job_id] = job
        _jobs_by_key[key] = job_id

    thread = threading.Thread(target=_run_render, args=(job_id, props), daemon=True)
    thread.start()
    return job


# ─── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/{match_id}/{fmt}/status", response_model=RenderJob)
def get_status(match_id: str, fmt: str) -> RenderJob:
    with _jobs_lock:
        job_id = _jobs_by_key.get((match_id, fmt))
        if not job_id:
            raise HTTPException(status_code=404, detail="sem job para essa partida/formato")
        return _jobs[job_id]


@router.get("/{match_id}/{fmt}")
def stream(match_id: str, fmt: str):
    path = _output_path(match_id, fmt)
    if not path.exists():
        raise HTTPException(status_code=404, detail="render ainda não disponível")
    _, _, ext = _format_config(fmt)
    media = "video/mp4" if ext == "mp4" else "image/png"
    return FileResponse(
        path=path,
        media_type=media,
        filename=f"fragreel-{match_id[:8]}.{ext}",
    )
