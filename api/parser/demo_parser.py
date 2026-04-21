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
    """Return rows as a list of dicts — handles Polars 0.x, 1.x and future APIs."""
    attempts = [
        ("to_dicts",   {},                 None),
        ("rows",       {"named": True},    None),
        ("iter_rows",  {"named": True},    None),
        ("rows",       {},                 None),   # tuples fallback — filtered below
    ]
    for method_name, kwargs, _ in attempts:
        method = getattr(df, method_name, None)
        if method is None:
            continue
        try:
            result = list(method(**kwargs))
            if not result:
                continue
            # Only accept dicts; rows() without named=True returns tuples
            if isinstance(result[0], dict):
                log.info(f"_df_iter_rows: {method_name}({kwargs}) → {len(result)} dicts")
                return result
        except Exception as e:
            log.debug(f"_df_iter_rows: {method_name}({kwargs}) failed: {e}")
    log.warning("_df_iter_rows: all methods exhausted — returning []")
    return []


def _df_last_row(df) -> dict:
    """Return the last row as a dict."""
    try:
        tail = df.tail(1)
        if hasattr(tail, "rows"):
            rows = tail.rows(named=True)
            return rows[-1] if rows else {}
        if hasattr(tail, "to_dicts"):
            dicts = tail.to_dicts()
            return dicts[-1] if dicts else {}
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
    try:
        df = dp.parse_event(
            "round_end",
            other=["ct_win_rounds", "t_win_rounds"],
        )
        if not _df_is_empty(df):
            last = _df_last_row(df)
            ct = int(last.get("ct_win_rounds") or 0)
            t  = int(last.get("t_win_rounds") or 0)
            return ct, t
    except Exception as e:
        log.debug(f"Could not parse round scores: {e}")
    return 0, 0


def _clean_weapon(weapon: str) -> str:
    return weapon.removeprefix("weapon_").strip()
