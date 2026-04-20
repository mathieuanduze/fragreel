import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from models import MatchOut, MatchSummary, GenerateRequest, GenerateResponse, JobStatus
from mock_data import MOCK_MATCHES, MOCK_MATCH_DETAIL

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[MatchSummary])
def list_matches():
    return MOCK_MATCHES


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: str):
    match = MOCK_MATCH_DETAIL.get(match_id)
    if not match:
        # Return first mock for any unknown id (demo purposes)
        match = MOCK_MATCH_DETAIL.get("match-001")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.post("/{match_id}/generate", response_model=GenerateResponse)
def generate_video(match_id: str, body: GenerateRequest):
    match = MOCK_MATCH_DETAIL.get(match_id) or MOCK_MATCH_DETAIL.get("match-001")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not body.highlight_ranks:
        raise HTTPException(status_code=422, detail="Select at least one highlight")

    format_times = {"reel": 45, "recap": 150, "card": 5}
    estimated = format_times.get(body.format.value, 60)

    return GenerateResponse(
        job_id=str(uuid.uuid4()),
        status=JobStatus.pending,
        estimated_seconds=estimated,
        message=f"Gerando {body.format.value} com {len(body.highlight_ranks)} highlight(s). Aguarde o anúncio.",
    )
