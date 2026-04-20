import sys
import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

# Allow importing the parser from sibling directory
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

router = APIRouter(prefix="/demo", tags=["demo"])

DEMO_DIR = Path(__file__).parent.parent.parent / "demos"
DEMO_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_demo(file: UploadFile = File(...), steamid: str = ""):
    """
    Receives a .dem file from the Windows client.
    Saves it locally, runs the parser, and queues highlight scoring.
    """
    if not file.filename or not file.filename.endswith(".dem"):
        raise HTTPException(status_code=422, detail="File must be a .dem")

    dest = DEMO_DIR / file.filename
    content = await file.read()
    dest.write_bytes(content)

    # Try to parse if demoparser2 is available
    try:
        from parser.demo_parser import parse
        from parser.scorer import score_kills

        parsed = parse(dest, player_steamid=steamid or None)
        highlights = score_kills(parsed, steamid) if steamid else []

        return {
            "status": "parsed",
            "map": parsed.map_name,
            "kills": len(parsed.kills),
            "highlights": len(highlights),
            "demo_path": str(dest),
        }
    except RuntimeError:
        # demoparser2 not installed — accept file, defer parsing
        return {
            "status": "queued",
            "message": "Demo recebida. Parser será executado quando demoparser2 estiver disponível.",
            "demo_path": str(dest),
        }
    except Exception as e:
        # Invalid demo file or parse error — still accepted, queued for retry
        return {
            "status": "queued",
            "message": f"Demo recebida mas não foi possível parsear agora: {type(e).__name__}. Será reprocessada.",
            "demo_path": str(dest),
        }
