"""
Clips endpoints — recebe clipes de vídeo do client Windows e os serve ao browser.

POST /clips/{match_id}          — client faz upload de um clipe (multipart)
GET  /clips/{match_id}/{rank}   — browser baixa/streama o clipe
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse

log = logging.getLogger("fragreel.clips")

router = APIRouter(prefix="/clips", tags=["clips"])

CLIPS_DIR = Path(__file__).parent.parent.parent / "data" / "clips"
CLIPS_DIR.mkdir(parents=True, exist_ok=True)

MAX_CLIP_BYTES = 500 * 1024 * 1024   # 500 MB por clipe


@router.post("/{match_id}")
async def upload_clip(
    match_id: str,
    request: Request,
    file: UploadFile = File(...),
):
    """
    Recebe um clipe de vídeo do client Windows.
    Nome do arquivo deve ser highlight_{rank:02d}.mp4 (ex: highlight_01.mp4).
    Atualiza o match document com a clip_url.
    """
    if not file.filename or not file.filename.endswith(".mp4"):
        raise HTTPException(status_code=422, detail="Arquivo deve ser .mp4")

    match_dir = CLIPS_DIR / match_id
    match_dir.mkdir(parents=True, exist_ok=True)

    dest = match_dir / file.filename
    content = await file.read()

    if len(content) > MAX_CLIP_BYTES:
        raise HTTPException(status_code=413, detail="Clipe muito grande (max 500 MB)")

    dest.write_bytes(content)
    log.info(f"Clip salvo: {match_id}/{file.filename} ({len(content) // 1024} KB)")

    # ── Extrair rank do nome do arquivo (highlight_01.mp4 → rank 1) ──────────
    try:
        rank = int(file.filename.replace("highlight_", "").replace(".mp4", ""))
    except Exception:
        rank = None

    # ── Atualizar match document com clip_url ─────────────────────────────────
    if rank is not None:
        try:
            from store import load_match, save_match
            doc = load_match(match_id)
            if doc:
                base_url = str(request.base_url).rstrip("/")
                clip_url = f"{base_url}/clips/{match_id}/{rank}"
                for h in doc.get("highlights", []):
                    if h.get("rank") == rank:
                        h["clip_url"] = clip_url
                        break
                save_match(match_id, doc)
                log.info(f"Match {match_id} highlight {rank} → clip_url salva")
        except Exception as e:
            log.warning(f"Não foi possível atualizar clip_url no match: {e}")

    return {"status": "ok", "file": file.filename, "bytes": len(content)}


@router.post("/{match_id}/batch")
async def upload_clips_batch(
    match_id: str,
    request: Request,
    files: list[UploadFile] = File(...),
):
    """Upload de vários clipes de uma vez."""
    results = []
    for f in files:
        # Reusar lógica do endpoint singular
        content = await f.read()
        if not f.filename or not f.filename.endswith(".mp4"):
            results.append({"file": f.filename, "status": "skipped"})
            continue
        if len(content) > MAX_CLIP_BYTES:
            results.append({"file": f.filename, "status": "too_large"})
            continue

        match_dir = CLIPS_DIR / match_id
        match_dir.mkdir(parents=True, exist_ok=True)
        dest = match_dir / f.filename
        dest.write_bytes(content)
        log.info(f"Clip (batch): {match_id}/{f.filename} ({len(content) // 1024} KB)")
        results.append({"file": f.filename, "status": "ok", "bytes": len(content)})

        # Atualizar clip_url no match doc
        try:
            rank = int(f.filename.replace("highlight_", "").replace(".mp4", ""))
            from store import load_match, save_match
            doc = load_match(match_id)
            if doc:
                base_url = str(request.base_url).rstrip("/")
                clip_url = f"{base_url}/clips/{match_id}/{rank}"
                for h in doc.get("highlights", []):
                    if h.get("rank") == rank:
                        h["clip_url"] = clip_url
                        break
                save_match(match_id, doc)
        except Exception as e:
            log.debug(f"clip_url update skipped: {e}")

    return {"status": "ok", "results": results}


@router.get("/{match_id}/{rank}")
def stream_clip(match_id: str, rank: int):
    """
    Serve o clipe de vídeo para o browser.
    Suporta Range requests (necessário para <video> HTML5).
    """
    clip_path = CLIPS_DIR / match_id / f"highlight_{rank:02d}.mp4"
    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clipe não encontrado")

    return FileResponse(
        path=clip_path,
        media_type="video/mp4",
        filename=clip_path.name,
    )
