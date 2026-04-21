"""
Steam OpenID 2.0 authentication + JWT session.

Flow:
  1.  GET /auth/steam/login  →  redirect to Steam OpenID
  2.  Steam redirects back to GET /auth/steam/callback
  3.  We verify the assertion with Steam (check_authentication)
  4.  Extract SteamID64, optionally fetch player profile
  5.  Issue a signed JWT and redirect to frontend /auth/callback?token=…
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import jwt
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

log = logging.getLogger("fragreel.auth")
router = APIRouter(prefix="/auth", tags=["auth"])

# ── Config (set these in Railway variables) ────────────────────────────────────
STEAM_OPENID_URL  = "https://steamcommunity.com/openid/login"
JWT_SECRET        = os.getenv("JWT_SECRET", "dev-secret-CHANGE-ME")
JWT_EXPIRE_DAYS   = 30
STEAM_API_KEY     = os.getenv("STEAM_API_KEY", "")          # optional
FRONTEND_URL      = os.getenv("FRAGREEL_DASHBOARD_URL",
                               "https://fragreel.vercel.app")


def _api_base(request: Request) -> str:
    """Derive the public API base URL."""
    # Railway injects RAILWAY_PUBLIC_DOMAIN automatically
    domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")
    if domain:
        return f"https://{domain}"
    # Local dev fallback
    base = str(request.base_url).rstrip("/")
    return base


# ── Login ─────────────────────────────────────────────────────────────────────

@router.get("/steam/login")
def steam_login(request: Request):
    """Redirect user to Steam OpenID consent screen."""
    base       = _api_base(request)
    return_to  = f"{base}/auth/steam/callback"
    realm      = base + "/"

    params = urllib.parse.urlencode({
        "openid.ns":         "http://specs.openid.net/auth/2.0",
        "openid.mode":       "checkid_setup",
        "openid.return_to":  return_to,
        "openid.realm":      realm,
        "openid.identity":   "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    })

    return RedirectResponse(f"{STEAM_OPENID_URL}?{params}")


# ── Callback ──────────────────────────────────────────────────────────────────

@router.get("/steam/callback")
async def steam_callback(request: Request):
    """Steam redirects here after the user approves (or denies)."""
    params = dict(request.query_params)

    if params.get("openid.mode") != "id_res":
        # User cancelled
        return RedirectResponse(f"{FRONTEND_URL}/login?error=cancelled")

    # Extract SteamID64 from claimed_id
    claimed = params.get("openid.claimed_id", "")
    prefix  = "https://steamcommunity.com/openid/id/"
    if not claimed.startswith(prefix):
        raise HTTPException(400, "Invalid Steam identity URL")

    steamid = claimed[len(prefix):]
    if not steamid.isdigit():
        raise HTTPException(400, "Invalid SteamID64")

    # Verify with Steam
    if not _verify_openid(params):
        raise HTTPException(401, "Steam OpenID verification failed")

    # Profile (name + avatar) — works without API key (basic info)
    name, avatar = _get_steam_profile(steamid)

    # JWT
    token = _create_jwt(steamid, name, avatar)

    log.info(f"Steam login OK: {steamid} ({name})")

    # Redirect frontend to store the token
    qs = urllib.parse.urlencode({"token": token, "steamid": steamid, "name": name})
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{qs}")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _verify_openid(params: dict) -> bool:
    """POST back to Steam to confirm the assertion is genuine."""
    verify = dict(params)
    verify["openid.mode"] = "check_authentication"

    try:
        data = urllib.parse.urlencode(verify).encode()
        req  = urllib.request.Request(
            STEAM_OPENID_URL, data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode()
            valid = "is_valid:true" in body
            if not valid:
                log.warning(f"Steam said is_valid:false — body: {body[:200]}")
            return valid
    except Exception as e:
        log.error(f"OpenID verify error: {e}")
        return False


def _get_steam_profile(steamid: str) -> tuple[str, str]:
    """Return (name, avatar_url). Falls back gracefully."""
    default_name   = f"Player{steamid[-4:]}"
    default_avatar = ""

    if not STEAM_API_KEY:
        return default_name, default_avatar

    try:
        url = (
            "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"
            f"?key={STEAM_API_KEY}&steamids={steamid}"
        )
        with urllib.request.urlopen(url, timeout=5) as resp:
            data   = json.loads(resp.read())
            player = data["response"]["players"][0]
            return (
                player.get("personaname", default_name),
                player.get("avatarmedium", default_avatar),
            )
    except Exception as e:
        log.debug(f"Steam profile fetch failed: {e}")
        return default_name, default_avatar


def _create_jwt(steamid: str, name: str, avatar: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "steamid": steamid,
        "name":    name,
        "avatar":  avatar,
        "iat":     now,
        "exp":     now + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    """Decode and validate a JWT — raises HTTPException on failure."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired — please log in again")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")


# ── /auth/me convenience endpoint ─────────────────────────────────────────────

@router.get("/me")
def get_me(request: Request):
    """Return current user from JWT in Authorization header."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    return decode_jwt(auth[7:])
