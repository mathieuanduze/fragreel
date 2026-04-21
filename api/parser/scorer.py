"""
Highlight scorer — groups player kills into sequences and ranks them.

Scoring criteria:
  - Multi-kill base score:  1k=30, 2k=150, 3k=400, 4k=700, 5k=1000
  - AWP / Scout bonus:      +50 per kill
  - Knife bonus:            +100 per kill
  - Headshot bonus:         +20 per kill
  - Desert Eagle bonus:     +20 per kill
Clip = [first_kill - PRE_SECS, last_kill + POST_SECS]
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from parser.demo_parser import Kill, ParsedDemo

log = logging.getLogger("fragreel.scorer")

# ── Constants ─────────────────────────────────────────────────────────────────

WINDOW_SECS   = 30.0   # max gap between kills to be grouped into one sequence
CLIP_PRE      = 7.0    # seconds before first kill in clip
CLIP_POST     = 5.0    # seconds after last kill in clip
MIN_CLIP_LEN  = 6.0    # minimum clip length in seconds
MAX_HIGHLIGHTS = 10    # max highlights returned

BASE_SCORE: dict[int, int] = {1: 30, 2: 150, 3: 400, 4: 700, 5: 1000}
HS_BONUS = 20

# Weapons with bonus points (lowercase, no "weapon_" prefix)
WEAPON_BONUS: dict[str, int] = {
    "awp": 50, "ssg08": 30,
    "knife": 100, "bayonet": 100, "knife_t": 100, "knifegg": 100,
    "deagle": 20, "revolver": 20,
}


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class KillInfo:
    label: str
    weapon: str
    headshot: bool
    hp: int = 0


@dataclass
class Highlight:
    rank: int
    round_num: int
    label: str
    score: float
    start: float
    end: float
    kills: list[KillInfo] = field(default_factory=list)


# ── Public API ────────────────────────────────────────────────────────────────

def score_kills(parsed: ParsedDemo, player_steamid: Optional[str] = None) -> list[Highlight]:
    """
    Score and rank player kills into highlight clips.
    Returns up to MAX_HIGHLIGHTS highlights, sorted best first.
    """
    kills = parsed.player_kills
    if not kills:
        log.info("No kills to score")
        return []

    kills = sorted(kills, key=lambda k: k.timestamp)
    sequences = _group_sequences(kills)
    log.info(f"Grouped {len(kills)} kills into {len(sequences)} sequences")

    scored: list[Highlight] = []
    for i, seq in enumerate(sequences):
        hl = _score_sequence(seq, rank=i + 1)
        scored.append(hl)

    # Sort by score descending and re-rank
    scored.sort(key=lambda h: h.score, reverse=True)
    for rank, hl in enumerate(scored, 1):
        hl.rank = rank

    return scored[:MAX_HIGHLIGHTS]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _group_sequences(kills: list[Kill]) -> list[list[Kill]]:
    """Group kills into multi-kill sequences (same round, within WINDOW_SECS)."""
    if not kills:
        return []

    groups: list[list[Kill]] = [[kills[0]]]
    for kill in kills[1:]:
        last_group = groups[-1]
        last_kill  = last_group[-1]

        same_round    = kill.round_num == last_kill.round_num
        within_window = (kill.timestamp - last_kill.timestamp) <= WINDOW_SECS

        if same_round and within_window:
            last_group.append(kill)
        else:
            groups.append([kill])

    return groups


def _score_sequence(seq: list[Kill], rank: int) -> Highlight:
    n          = len(seq)
    base       = BASE_SCORE.get(min(n, 5), 1000)
    bonus      = 0
    kill_infos: list[KillInfo] = []

    for kill in seq:
        wep_lower    = kill.weapon.lower()
        wep_bonus    = next((pts for key, pts in WEAPON_BONUS.items() if key in wep_lower), 0)
        hs_bonus_pts = HS_BONUS if kill.headshot else 0
        bonus       += wep_bonus + hs_bonus_pts

        kill_infos.append(KillInfo(
            label=_kill_label(kill),
            weapon=kill.weapon,
            headshot=kill.headshot,
        ))

    score = float(base + bonus)
    start = max(0.0, round(seq[0].timestamp - CLIP_PRE, 1))
    end   = round(seq[-1].timestamp + CLIP_POST, 1)
    if end - start < MIN_CLIP_LEN:
        end = round(start + MIN_CLIP_LEN, 1)

    return Highlight(
        rank=rank,
        round_num=seq[0].round_num,
        label=_sequence_label(n, seq),
        score=round(score, 1),
        start=start,
        end=end,
        kills=kill_infos,
    )


def _kill_label(kill: Kill) -> str:
    """Human-readable label for a single kill."""
    weapon = _weapon_display(kill.weapon)
    parts  = [weapon]
    if kill.headshot:
        parts.append("HS")
    return " · ".join(parts)


def _sequence_label(n: int, seq: list[Kill]) -> str:
    """Label for the entire highlight sequence."""
    weapons = [k.weapon.lower() for k in seq]
    round_n = seq[0].round_num

    if n >= 5:
        prefix = "ACE"
    elif n == 4:
        prefix = "4K"
    elif n == 3:
        prefix = "3K"
    elif n == 2:
        prefix = "2K"
    else:
        prefix = "1K"

    # Special flavours
    if any("knife" in w for w in weapons):
        return f"Knife {prefix} · Round {round_n}"
    if all(w in ("awp", "ssg08") for w in weapons):
        return f"AWP {prefix} · Round {round_n}"
    if n == 1 and seq[0].headshot:
        return f"{_weapon_display(seq[0].weapon)} · HS · Round {round_n}"

    return f"{prefix} · Round {round_n}"


_WEAPON_NAMES: dict[str, str] = {
    "awp": "AWP", "ak47": "AK-47", "m4a1": "M4A1-S", "m4a1_silencer": "M4A1-S",
    "m4a4": "M4A4", "deagle": "Desert Eagle", "ssg08": "SSG 08",
    "famas": "FAMAS", "galilar": "Galil AR", "sg556": "SG 553", "aug": "AUG",
    "knife": "Knife", "bayonet": "Bayonet", "knife_t": "Knife",
    "mp9": "MP9", "mac10": "MAC-10", "ump45": "UMP-45", "p90": "P90",
    "bizon": "PP-Bizon", "mp5sd": "MP5-SD", "mp7": "MP7",
    "nova": "Nova", "xm1014": "XM1014", "mag7": "MAG-7",
    "sawedoff": "Sawed-Off", "negev": "Negev", "m249": "M249",
    "p250": "P250", "cz75a": "CZ75-Auto", "fiveseven": "Five-SeveN",
    "tec9": "Tec-9", "usp_silencer": "USP-S", "glock": "Glock-18",
    "hkp2000": "P2000", "revolver": "R8 Revolver", "p2000": "P2000",
}


def _weapon_display(weapon: str) -> str:
    return _WEAPON_NAMES.get(weapon.lower(), weapon.upper())
