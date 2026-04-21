"""
CS2 demo parser — wraps demoparser2 and returns a clean ParsedDemo object.

demoparser2 docs: https://github.com/LaihoE/demoparser
"""
from __future__ import annotations

import logging
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

log = logging.getLogger("fragreel.parser")

try:
    from demoparser2 import DemoParser as _DP
    HAS_DEMOPARSER = True
except ImportError:
    HAS_DEMOPARSER = False
    log.warning("demoparser2 not installed — demo parsing unavailable")


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class Kill:
    tick: int
    timestamp: float        # seconds from demo start
    round_num: int          # 1-indexed
    weapon: str             # clean name, no "weapon_" prefix
    headshot: bool
    attacker_steamid: str
    victim_steamid: str


@dataclass
class ParsedDemo:
    map_name: str
    tickrate: float
    duration: float         # total demo duration in seconds
    player_steamid: str
    player_kills: list[Kill]
    all_kills: list[Kill]
    ct_score: int
    t_score: int


# ── DataFrame compat helpers (Polars 0.x and 1.x) ────────────────────────────

def _df_is_empty(df) -> bool:
    """Works for both Polars 0.x (is_empty) and 1.x (len == 0)."""
    if df is None:
        return True
    try:
        if hasattr(df, "is_empty"):
            return df.is_empty()
    except Exception:
        pass
    try:
        return len(df) == 0
    except Exception:
        return True


def _df_iter_rows(df) -> list[dict]:
    """Return rows as a list of dicts — handles Polars, pandas, and future APIs."""
    log.info(f"_df_iter_rows: df type={type(df).__module__}.{type(df).__name__}")

    # ── Pandas DataFrame ──────────────────────────────────────────────────────
    # pandas: df.to_dict(orient="records") → list[dict]
    to_dict = getattr(df, "to_dict", None)
    if to_dict is not None:
        try:
            result = to_dict(orient="records")
            if isinstance(result, list) and result and isinstance(result[0], dict):
                log.info(f"_df_iter_rows: pandas to_dict → {len(result)} dicts")
                return result
        except Exception as e:
            log.debug(f"_df_iter_rows: to_dict(orient='records') failed: {e}")

    # ── Polars DataFrame ──────────────────────────────────────────────────────
    attempts = [
        ("to_dicts",  {}),
        ("rows",      {"named": True}),
        ("iter_rows", {"named": True}),
    ]
    for method_name, kwargs in attempts:
        method = getattr(df, method_name, None)
        if method is None:
            log.debug(f"_df_iter_rows: {method_name} not found on {type(df).__name__}")
            continue
        try:
            result = list(method(**kwargs))
            if not result:
                log.debug(f"_df_iter_rows: {method_name}({kwargs}) returned empty list")
                continue
            if isinstance(result[0], dict):
                log.info(f"_df_iter_rows: {method_name}({kwargs}) → {len(result)} dicts")
                return result
            log.debug(f"_df_iter_rows: {method_name}({kwargs}) returned {type(result[0])}, not dict")
        except Exception as e:
            log.warning(f"_df_iter_rows: {method_name}({kwargs}) raised {type(e).__name__}: {e}")

    log.warning(f"_df_iter_rows: all methods exhausted — df type={type(df)}, attrs={[a for a in dir(df) if not a.startswith('_')][:20]}")
    return []


def _df_last_row(df) -> dict:
    """Return the last row as a dict (Polars and pandas)."""
    try:
        tail = df.tail(1)
        rows = _df_iter_rows(tail)
        return rows[0] if rows else {}
    except Exception as e:
        log.debug(f"_df_last_row fallback: {e}")
    return {}


# ── Public API ────────────────────────────────────────────────────────────────

def parse(demo_path: Path, player_steamid: Optional[str] = None) -> ParsedDemo:
    """
    Parse a CS2 .dem file and return structured kill data.

    Raises:
        RuntimeError: if demoparser2 is not installed
        FileNotFoundError: if the demo file doesn't exist
    """
    if not HAS_DEMOPARSER:
        raise RuntimeError("demoparser2 not installed")

    demo_path = Path(demo_path)
    if not demo_path.exists():
        raise FileNotFoundError(f"Demo not found: {demo_path}")

    log.info(f"Parsing demo: {demo_path.name}")
    dp = _DP(str(demo_path))

    # ── Header ────────────────────────────────────────────────────────────────
    header = dp.parse_header()
    map_name   = str(header.get("map_name", "unknown"))
    pb_ticks   = int(header.get("playback_ticks", 0))
    pb_time    = float(header.get("playback_time", 0.0))
    tickrate   = round(pb_ticks / pb_time, 1) if pb_time > 0 else 64.0
    duration   = pb_time

    log.info(f"Map: {map_name} | Tickrate: {tickrate} | Duration: {duration:.1f}s")

    # ── Kill events ───────────────────────────────────────────────────────────
    kills = _parse_kills(dp, tickrate)
    log.info(f"Total kills parsed: {len(kills)}")

    # ── Scores ────────────────────────────────────────────────────────────────
    ct_score, t_score = _parse_score(dp)

    # ── Filter by player ──────────────────────────────────────────────────────
    steamid_str = str(player_steamid).strip() if player_steamid else ""
    if steamid_str:
        player_kills = [k for k in kills if k.attacker_steamid == steamid_str]
        log.info(f"Player {steamid_str} kills: {len(player_kills)}")
    else:
        player_kills = kills

    return ParsedDemo(
        map_name=map_name,
        tickrate=tickrate,
        duration=duration,
        player_steamid=steamid_str,
        player_kills=player_kills,
        all_kills=kills,
        ct_score=ct_score,
        t_score=t_score,
    )


# ── Internal helpers ──────────────────────────────────────────────────────────

def _parse_kills(dp, tickrate: float) -> list[Kill]:
    """Extract kill events from demo."""
    df = None
    last_err = None
    for kwargs in [
        {"other": ["total_rounds_played"]},
        {},
    ]:
        try:
            df = dp.parse_event("player_death", **kwargs)
            if df is not None:
                break
        except Exception as e:
            last_err = e
            log.warning(f"parse_event attempt failed ({kwargs}): {e}")

    if _df_is_empty(df):
        log.warning(f"No player_death events found in demo (last_err={last_err})")
        return []

    cols = set(df.columns)
    log.info(f"player_death columns ({len(df)} rows): {sorted(cols)}")

    # Try to detect attacker steamid column name automatically
    # (varies across demoparser2 versions)
    _ATTACKER_COLS = [
        "attacker_steamid", "attacker_steamID",
        "attacker_steam_id", "attacker_xuid",
    ]
    _VICTIM_COLS = [
        "user_steamid", "victim_steamid",
        "victim_steam_id", "user_xuid",
    ]
    attacker_col = next((c for c in _ATTACKER_COLS if c in cols), None)
    victim_col   = next((c for c in _VICTIM_COLS   if c in cols), None)

    if attacker_col is None:
        # Last resort: look for any column containing "attacker" and "id"
        attacker_col = next(
            (c for c in cols if "attacker" in c.lower() and ("id" in c.lower() or "xuid" in c.lower())),
            None,
        )
    if victim_col is None:
        victim_col = next(
            (c for c in cols if ("victim" in c.lower() or "user" in c.lower()) and ("id" in c.lower() or "xuid" in c.lower())),
            None,
        )

    log.info(f"Using attacker_col={attacker_col!r}, victim_col={victim_col!r}")

    kills: list[Kill] = []
    skipped = 0
    for row in _df_iter_rows(df):
        try:
            raw_attacker = row.get(attacker_col) if attacker_col else None
            attacker = str(raw_attacker or "").strip()
            if not attacker or attacker in ("0", "None", "nan", ""):
                skipped += 1
                continue

            tick     = int(row.get("tick") or 0)
            weapon   = _clean_weapon(str(row.get("weapon") or "unknown"))
            headshot = bool(row.get("headshot", False))

            round_raw = row.get("total_rounds_played")
            round_num = (int(round_raw) + 1) if round_raw is not None else 1

            raw_victim = row.get(victim_col) if victim_col else None
            victim = str(raw_victim or "").strip()

            kills.append(Kill(
                tick=tick,
                timestamp=round(tick / tickrate, 3),
                round_num=round_num,
                weapon=weapon,
                headshot=headshot,
                attacker_steamid=attacker,
                victim_steamid=victim,
            ))
        except Exception as e:
            log.debug(f"Skipping kill row: {e}")
            skipped += 1
            continue

    log.info(f"Kills extracted: {len(kills)} (skipped {skipped})")
    return kills


def _parse_score(dp) -> tuple[int, int]:
    """Extract final CT and T round wins from round_end events."""
    # Try with cumulative score columns first, then without
    for kwargs in [{"other": ["ct_win_rounds", "t_win_rounds"]}, {}]:
        try:
            df = dp.parse_event("round_end", **kwargs)
            if _df_is_empty(df):
                continue
            cols = set(df.columns) if hasattr(df, "columns") else set()
            log.info(f"round_end columns: {sorted(cols)}")
            last = _df_last_row(df)
            if not last:
                continue
            # Try cumulative columns
            ct = last.get("ct_win_rounds")
            t  = last.get("t_win_rounds")
            if ct is not None and t is not None:
                return int(ct or 0), int(t or 0)
            # Try winner column: 2=CT, 3=T
            winner_col = next((c for c in ("winner", "win_reason", "round_win_reason") if c in cols), None)
            if winner_col:
                # Count CT/T wins across all rows
                rows = _df_iter_rows(df)
                ct_w = sum(1 for r in rows if int(r.get(winner_col) or 0) == 2)
                t_w  = len(rows) - ct_w
                if ct_w + t_w > 0:
                    return ct_w, t_w
        except Exception as e:
            log.warning(f"_parse_score attempt {kwargs} failed: {e}")
    log.warning("_parse_score: could not determine score, returning 0-0")
    return 0, 0


def _clean_weapon(weapon: str) -> str:
    return weapon.removeprefix("weapon_").strip()
