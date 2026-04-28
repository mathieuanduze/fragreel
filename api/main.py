import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.matches import router as matches_router
from routes.demo import router as demo_router
from routes.auth import router as auth_router
from routes.clips import router as clips_router
from routes.renders import router as renders_router

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

# CORS: allow_origins não suporta wildcards do tipo "https://*.vercel.app"
# (Starlette só aceita patterns via allow_origin_regex). Listamos hosts
# explicitamente: prod (fragreel.gg + www.fragreel.gg), preview deploys
# Vercel (regex), e dev local. Bug #17 (28/04): adicionado fragreel.gg
# após compra do domínio.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3033",
        "https://fragreel.gg",
        "https://www.fragreel.gg",
        "https://fragreel.vercel.app",  # mantido como fallback do Vercel default
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # cobre preview deploys
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(matches_router)
app.include_router(demo_router)
app.include_router(clips_router)
app.include_router(renders_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
