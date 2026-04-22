"""
Render pipeline — orquestra o Remotion via subprocess.

/renders/{match_id}/{format}/status → {status: rendering|done|error, progress}
/renders/{match_id}/{format}        → streama o MP4/PNG final
"""
from __future__ import annotations

import json
import logging
import re
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
        return "Recap", "render", "mp4"
    raise ValueError(f"unknown format: {fmt}")


# ─── Parser de progresso do stdout do Remotion ────────────────────────────────
# Remotion (com --log=info, default) imprime linhas no formato:
#   Bundled ...
#   Rendered 24/495
#   Rendered 48/495
# Capturamos o último (current/total) que aparecer.
_PROGRESS_RX = re.compile(r"(\d+)\s*/\s*(\d+)")
# Algumas versões do Remotion mostram o progress como porcentagem dentro
# de uma "barra ASCII" no formato "▒▒▒▒▒▒░░░░ 60%".
_PERCENT_RX = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def _parse_progress(line: str) -> Optional[float]:
    """Extrai progresso 0.0–0.95 de uma linha de stdout do Remotion.
    Capamos em 0.95 — só viramos 1.0 quando o subprocess sai com 0."""
    # Pula linhas vazias / cabeçalho
    if not line:
        return None
    m = _PROGRESS_RX.search(line)
    if m:
        cur = int(m.group(1))
        total = int(m.group(2))
        if total > 0:
            return min(0.95, cur / total)
    m = _PERCENT_RX.search(line)
    if m:
        try:
            pct = float(m.group(1)) / 100.0
            return min(0.95, pct)
        except ValueError:
            return None
    return None


def _output_path(match_id: str, fmt: str) -> Path:
    _, _, ext = _format_config(fmt)
    out_dir = RENDERS_DIR / match_id
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / f"{fmt}.{ext}"


RENDER_TIMEOUT_SEC = 600  # 10min hard cap


def _run_render(job_id: str, props: dict[str, Any]) -> None:
    """Executa o render do Remotion via Popen, streamando stdout pra
    extrair progresso real (current/total frames). Job.progress vai de
    0 → 0.95 enquanto roda; vira 1.0 só quando o subprocess sai com 0.
    """
    job = _jobs[job_id]
    comp_id, subcmd, ext = _format_config(job.format)
    out_path = _output_path(job.match_id, job.format)

    cmd: list[str] = [
        "npx", "remotion", subcmd, comp_id, str(out_path),
        "--props", json.dumps(props),
        # --log=info é o default; deixa explícito porque precisamos das
        # linhas de progresso que --log=error suprime.
        "--log=info",
    ]
    if subcmd == "still":
        cmd.extend(["--frame", "30"])

    log.info("[render %s] start · match=%s format=%s", job_id, job.match_id, job.format)
    with _jobs_lock:
        job.status = "rendering"

    proc: Optional[subprocess.Popen] = None
    deadline = time.time() + RENDER_TIMEOUT_SEC
    last_lines: list[str] = []  # buffer dos últimos N pra reportar erro

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=EDITOR_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # mistura stderr no stdout pra simplificar
            text=True,
            bufsize=1,  # line-buffered
        )

        assert proc.stdout is not None
        for raw_line in proc.stdout:
            if time.time() > deadline:
                proc.kill()
                raise subprocess.TimeoutExpired(cmd, RENDER_TIMEOUT_SEC)

            line = raw_line.rstrip()
            if not line:
                continue

            # mantém buffer pequeno pra debug
            last_lines.append(line)
            if len(last_lines) > 40:
                last_lines.pop(0)

            pct = _parse_progress(line)
            if pct is not None:
                with _jobs_lock:
                    # nunca regride
                    if pct > job.progress:
                        job.progress = pct

        return_code = proc.wait()
        if return_code != 0:
            tail = "\n".join(last_lines[-15:])
            log.error("[render %s] failed (code=%s): %s", job_id, return_code, tail)
            with _jobs_lock:
                job.status = "error"
                job.error = tail or f"subprocess falhou (code={return_code})"
                job.finished_at = time.time()
            return

        log.info("[render %s] done · %s", job_id, out_path)
        with _jobs_lock:
            job.status = "done"
            job.progress = 1.0
            job.path = str(out_path)
            job.finished_at = time.time()

    except subprocess.TimeoutExpired:
        log.error("[render %s] timeout após %ss", job_id, RENDER_TIMEOUT_SEC)
        if proc and proc.poll() is None:
            proc.kill()
        with _jobs_lock:
            job.status = "error"
            job.error = f"timeout após {RENDER_TIMEOUT_SEC}s"
            job.finished_at = time.time()
    except Exception as e:
        log.exception("[render %s] exception", job_id)
        if proc and proc.poll() is None:
            proc.kill()
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
