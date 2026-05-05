"""
Match document store with dual backend.

Sprint #4 (05/05) — R2 Storage Migration:
  Bug #10 root cause was Railway filesystem efêmero — todo redeploy
  destruía data/matches/ → user clica /match/<id> → 404 → AutoReanalyze
  paliativo (lento, custa compute, confunde users).

  Fix: persistir em Cloudflare R2 (S3-compatible, free egress).
  Match docs sobrevivem redeploys infinitamente.

Backend selection:
  - **R2** (production): activates quando todas 4 env vars presentes:
      R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
    Usa boto3 com endpoint custom (Cloudflare R2 é S3-compatível).
  - **Filesystem** (dev/fallback): data/matches/<id>.json ao lado da api/.
    Default quando R2 env vars ausentes ou boto3 não-instalado.

Interface inalterada vs versão pre-Sprint #4 (save/load/list/exists).
Routes não precisam de mudança — backend transparente.

Migração de dados existentes: api/scripts/migrate_to_r2.py
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

log = logging.getLogger("fragreel.store")

# ── Backend selection ────────────────────────────────────────────────────────


def _r2_env_complete() -> bool:
    """True se todas as 4 R2 env vars estão setadas e não-vazias."""
    required = ("R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
    return all(bool(os.environ.get(k, "").strip()) for k in required)


_USE_R2 = _r2_env_complete()
_R2_CLIENT = None  # lazy-init


def _get_r2_client():
    """Singleton boto3 client pra R2. Lazy-init pra evitar import boto3 em dev."""
    global _R2_CLIENT
    if _R2_CLIENT is not None:
        return _R2_CLIENT
    try:
        import boto3  # type: ignore
    except ImportError as e:
        log.error("R2 enabled mas boto3 não instalado: %s. Fallback pra filesystem.", e)
        return None
    account_id = os.environ["R2_ACCOUNT_ID"]
    _R2_CLIENT = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",  # R2 doesn't use regions
    )
    log.info("R2 client initialized (bucket=%s)", os.environ.get("R2_BUCKET"))
    return _R2_CLIENT


# ── Filesystem backend (fallback / dev) ──────────────────────────────────────

STORE_DIR = Path(__file__).parent.parent / "data" / "matches"
STORE_DIR.mkdir(parents=True, exist_ok=True)


def _fs_save(match_id: str, data: dict) -> None:
    path = STORE_DIR / f"{match_id}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _fs_load(match_id: str) -> Optional[dict]:
    path = STORE_DIR / f"{match_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception as e:
        log.error("FS load failed match=%s: %s", match_id, e)
        return None


def _fs_list(steamid: Optional[str], limit: int) -> list[dict]:
    results: list[dict] = []
    files = sorted(STORE_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    for f in files:
        if len(results) >= limit:
            break
        try:
            doc = json.loads(f.read_text())
            if steamid and doc.get("steamid") != steamid:
                continue
            results.append(doc)
        except Exception:
            continue
    return results


def _fs_exists(match_id: str) -> bool:
    return (STORE_DIR / f"{match_id}.json").exists()


# ── R2 backend ───────────────────────────────────────────────────────────────


def _r2_key(match_id: str) -> str:
    """Object key no bucket. Convenção: matches/<id>.json (top-level prefix
    pra eventual co-existência futura com outras categorias)."""
    return f"matches/{match_id}.json"


def _r2_save(match_id: str, data: dict) -> None:
    client = _get_r2_client()
    if client is None:
        # boto3 não instalado mas env diz R2 ativo — degrada pra filesystem
        # (better than crash). Mac log warning pra investigation.
        log.warning("R2 fallback to FS pra save (client init failed)")
        _fs_save(match_id, data)
        return
    bucket = os.environ["R2_BUCKET"]
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    # Metadata custom pra filtering eficiente em list_matches (evita
    # baixar todos os bodies pra filtrar por steamid).
    metadata = {}
    if data.get("steamid"):
        metadata["steamid"] = str(data["steamid"])
    client.put_object(
        Bucket=bucket,
        Key=_r2_key(match_id),
        Body=body,
        ContentType="application/json",
        Metadata=metadata,
    )


def _r2_load(match_id: str) -> Optional[dict]:
    client = _get_r2_client()
    if client is None:
        return _fs_load(match_id)
    bucket = os.environ["R2_BUCKET"]
    try:
        resp = client.get_object(Bucket=bucket, Key=_r2_key(match_id))
        return json.loads(resp["Body"].read())
    except client.exceptions.NoSuchKey:
        return None
    except Exception as e:
        log.error("R2 load failed match=%s: %s", match_id, e)
        return None


def _r2_list(steamid: Optional[str], limit: int) -> list[dict]:
    """List matches via R2 ListObjectsV2 + per-object metadata filter.

    Trade-off: pra steamid filtering eficiente, salvamos steamid em
    object Metadata na hora do save. List response inclui metadata
    quando usamos `head_object` per-key — caro pra muitas matches.

    Estratégia atual: list todos por LastModified, filtrar via
    metadata em loop até hit limit. OK até ~1000 matches/user; depois
    precisa migrar pra DB real (Sprint futura).
    """
    client = _get_r2_client()
    if client is None:
        return _fs_list(steamid, limit)
    bucket = os.environ["R2_BUCKET"]

    # ListObjectsV2 retorna até 1000 keys por page. Sortable por LastModified
    # via paginar e ordenar manual.
    paginator = client.get_paginator("list_objects_v2")
    all_keys = []
    for page in paginator.paginate(Bucket=bucket, Prefix="matches/"):
        for obj in page.get("Contents", []):
            all_keys.append((obj["Key"], obj["LastModified"]))

    # Sort desc por LastModified (mais recentes primeiro)
    all_keys.sort(key=lambda kv: kv[1], reverse=True)

    results: list[dict] = []
    for key, _last_modified in all_keys:
        if len(results) >= limit:
            break
        # Per-object filter — load body + check steamid
        try:
            resp = client.get_object(Bucket=bucket, Key=key)
            doc = json.loads(resp["Body"].read())
            if steamid and doc.get("steamid") != steamid:
                continue
            results.append(doc)
        except Exception as e:
            log.warning("R2 list skipping key=%s: %s", key, e)
            continue
    return results


def _r2_exists(match_id: str) -> bool:
    client = _get_r2_client()
    if client is None:
        return _fs_exists(match_id)
    bucket = os.environ["R2_BUCKET"]
    try:
        client.head_object(Bucket=bucket, Key=_r2_key(match_id))
        return True
    except client.exceptions.ClientError as e:
        if e.response.get("Error", {}).get("Code") == "404":
            return False
        # Outro erro — log + assume false (libera AutoReanalyze paliativo)
        log.warning("R2 head_object error match=%s: %s", match_id, e)
        return False


# ── Public interface (unchanged) ─────────────────────────────────────────────


def save_match(match_id: str, data: dict) -> None:
    if _USE_R2:
        _r2_save(match_id, data)
    else:
        _fs_save(match_id, data)
    log.info("Saved match: %s (backend=%s)", match_id, "r2" if _USE_R2 else "fs")


def load_match(match_id: str) -> Optional[dict]:
    return _r2_load(match_id) if _USE_R2 else _fs_load(match_id)


def list_matches(steamid: Optional[str] = None, limit: int = 50) -> list[dict]:
    return _r2_list(steamid, limit) if _USE_R2 else _fs_list(steamid, limit)


def match_exists(match_id: str) -> bool:
    return _r2_exists(match_id) if _USE_R2 else _fs_exists(match_id)


def backend_name() -> str:
    """Pra logging/diagnose. Útil em /health endpoint."""
    return "r2" if _USE_R2 else "filesystem"
