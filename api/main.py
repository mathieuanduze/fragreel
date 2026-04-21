import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.matches import router as matches_router
from routes.demo import router as demo_router
from routes.auth import router as auth_router

# ── Logging — must run before any module imports loggers ──────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
    force=True,
)
log = logging.getLogger("fragreel")
log.info("FragReel API starting up")

app = FastAPI(title="FragReel API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3033",
        "https://fragreel.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(matches_router)
app.include_router(demo_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
