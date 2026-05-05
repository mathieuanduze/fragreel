"""
One-shot migration: filesystem matches → R2 bucket.

Sprint #4 (05/05) — quando R2 env vars são setadas pela primeira vez no
Railway, esse script lê todos os match docs em data/matches/*.json local
e faz upload pra R2 mantendo o mesmo match_id como key.

Uso:
  cd api/
  R2_ACCOUNT_ID=... R2_BUCKET=fragreel-matches \\
  R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \\
  python scripts/migrate_to_r2.py [--dry-run]

Idempotente — se um match_id já existe em R2 com mesmo content, skip.
Se difere, sobrescreve com versão local (assume local é source-of-truth
no momento da migração).

Roda 1x na transição. Após migrate completo, próximos saves vão direto
pra R2 via store.py backend selection. Match docs antigos em
data/matches/ podem ficar (filesystem efêmero do Railway destrói no
próximo redeploy de qualquer forma — sem cleanup necessário).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("fragreel.migrate")


def main() -> int:
    parser = argparse.ArgumentParser(description="Migra match docs filesystem → R2")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem fazer upload")
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path(__file__).parent.parent.parent / "data" / "matches",
        help="Pasta com match docs filesystem",
    )
    args = parser.parse_args()

    # Validate env vars
    required = ("R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        log.error("Missing env vars: %s. Configure antes de rodar.", missing)
        return 2

    if not args.source_dir.is_dir():
        log.error("Source dir não existe: %s", args.source_dir)
        return 2

    matches = list(args.source_dir.glob("*.json"))
    log.info("Achei %d match docs em %s", len(matches), args.source_dir)

    if not matches:
        log.info("Nada pra migrar.")
        return 0

    if args.dry_run:
        log.info("DRY RUN — listando files que seriam migrados:")
        for f in matches[:10]:
            log.info("  %s (%s bytes)", f.name, f.stat().st_size)
        if len(matches) > 10:
            log.info("  ... +%d more", len(matches) - 10)
        return 0

    try:
        import boto3
    except ImportError:
        log.error("boto3 não instalado. Run: pip install boto3>=1.35.0")
        return 2

    client = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    bucket = os.environ["R2_BUCKET"]

    n_uploaded = 0
    n_skipped = 0
    n_failed = 0
    for f in matches:
        match_id = f.stem
        key = f"matches/{match_id}.json"
        try:
            doc = json.loads(f.read_text())
            metadata = {}
            if doc.get("steamid"):
                metadata["steamid"] = str(doc["steamid"])

            # Check existing — skip if same size (cheap dedup)
            try:
                head = client.head_object(Bucket=bucket, Key=key)
                if head.get("ContentLength") == f.stat().st_size:
                    log.info("[skip] %s já existe em R2 (mesmo size)", match_id)
                    n_skipped += 1
                    continue
            except client.exceptions.ClientError:
                pass  # 404 = não existe → upload

            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=json.dumps(doc, ensure_ascii=False).encode("utf-8"),
                ContentType="application/json",
                Metadata=metadata,
            )
            log.info("[uploaded] %s (%d bytes)", match_id, f.stat().st_size)
            n_uploaded += 1
        except Exception as e:
            log.error("[failed] %s: %s", match_id, e)
            n_failed += 1

    log.info("=" * 50)
    log.info("Migration done: %d uploaded, %d skipped, %d failed", n_uploaded, n_skipped, n_failed)
    return 0 if n_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
