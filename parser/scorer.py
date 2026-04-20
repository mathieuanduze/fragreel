"""
Scores kill events and selects the top N highlights for a player.
"""
from dataclasses import dataclass
from .demo_parser import KillEvent, ParsedDemo


# ── Base scores ───────────────────────────────────────────────────
WEAPON_SCORES: dict[str, int] = {
    "knife":       30,
    "taser":       25,
    "deagle":      20,
    "revolver":    20,
    "awp":         15,
    "ssg08":       14,
    "pistol":      18,  # fallback for any pistol
    "rifle":       10,  # fallback for any rifle
    "smg":          8,
    "shotgun":      8,
    "lmg":          6,
}

PISTOLS  = {"deagle", "revolver", "usp_silencer", "glock", "p250", "cz75a", "fiveseven", "tec9", "hkp2000", "elite"}
RIFLES   = {"ak47", "m4a1", "m4a1_silencer", "famas", "galil", "sg556", "aug", "scar20", "g3sg1"}
SMGS     = {"mp9", "mac10", "mp7", "mp5sd", "ump45", "p90", "bizon"}
SHOTGUNS = {"nova", "xm1014", "sawedoff", "mag7"}
LMGS     = {"m249", "negev"}


def _weapon_base(weapon: str) -> int:
    w = weapon.lower()
    if w in WEAPON_SCORES:
        return WEAPON_SCORES[w]
    if w in PISTOLS:
        return WEAPON_SCORES["pistol"]
    if w in RIFLES:
        return WEAPON_SCORES["rifle"]
    if w in SMGS:
        return WEAPON_SCORES["smg"]
    if w in SHOTGUNS:
        return WEAPON_SCORES["shotgun"]
    if w in LMGS:
        return WEAPON_SCORES["lmg"]
    return 10  # default


@dataclass
class ScoredKill:
    kill: KillEvent
    score: float
    label: str  # human-readable: "AWP HEADSHOT", "CLUTCH 1v3", etc.


@dataclass
class Highlight:
    """A highlight is a round-level group of kills (clutch, multi-kill, or single)."""
    round_num: int
    kills: list[ScoredKill]
    total_score: float
    label: str               # "ACE", "CLUTCH 1v3", "3K", "AWP HEADSHOT", etc.
    start_tick: int          # tick of first kill in the group
    end_tick: int            # tick of last kill


def _label(kill: KillEvent, multi_count: int = 1, clutch_vs: int = 0) -> str:
    parts = []
    if clutch_vs >= 2:
        parts.append(f"CLUTCH 1v{clutch_vs}")
    elif multi_count == 5:
        parts.append("ACE")
    elif multi_count >= 2:
        parts.append(f"{multi_count}K")

    weapon = kill.weapon.upper().replace("_", " ").replace("SILENCER", "").strip()
    parts.append(weapon)

    if kill.headshot:
        parts.append("HS")
    if kill.noscope:
        parts.append("NOSCOPE")
    if kill.thru_smoke:
        parts.append("SMOKE")
    if kill.attacker_blind:
        parts.append("BLIND")
    if kill.killer_hp < 20:
        parts.append(f"{kill.killer_hp}HP")

    return "  ·  ".join(parts)


def score_kills(parsed: ParsedDemo, player_steamid: str, top_n: int = 5) -> list[Highlight]:
    """
    Score all kills by the given player and return the top N highlights.
    Groups kills by round to detect multi-kills and clutches.
    """
    # Filter to player's kills only
    player_kills = [k for k in parsed.kills if k.killer_steamid == player_steamid]

    if not player_kills:
        return []

    # Group by round
    by_round: dict[int, list[KillEvent]] = {}
    for k in player_kills:
        by_round.setdefault(k.round_num, []).append(k)

    highlights: list[Highlight] = []

    for round_num, kills in by_round.items():
        kills.sort(key=lambda k: k.tick)
        n = len(kills)

        # Detect clutch: player won a round where they were outnumbered
        # Approximation: if they got 2+ kills in a row quickly, assume clutch
        clutch_vs = 0
        if n >= 2:
            time_span = (kills[-1].tick - kills[0].tick) / parsed.tick_rate
            if time_span < 15:
                clutch_vs = n  # simplified — real clutch detection needs alive-count data

        round_score = 0.0
        scored_kills: list[ScoredKill] = []

        for i, kill in enumerate(kills):
            s = float(_weapon_base(kill.weapon))

            # bonuses
            if kill.headshot:      s += 5
            if kill.killer_hp < 20: s += 10
            if kill.attacker_blind: s += 8
            if kill.noscope:        s += 12
            if kill.thru_smoke:     s += 7

            # multi-kill multiplier (all kills in same round)
            if n == 2:   s *= 1.5
            elif n == 3: s *= 2.0
            elif n == 4: s *= 2.5
            elif n >= 5: s *= 3.0

            # clutch bonus
            if clutch_vs >= 2: s += 15
            if clutch_vs >= 3: s += 10

            scored_kills.append(ScoredKill(
                kill=kill,
                score=round(s, 1),
                label=_label(kill, multi_count=n, clutch_vs=clutch_vs),
            ))
            round_score += s

        highlights.append(Highlight(
            round_num=round_num,
            kills=scored_kills,
            total_score=round(round_score, 1),
            label=scored_kills[0].label if scored_kills else "",
            start_tick=kills[0].tick,
            end_tick=kills[-1].tick,
        ))

    # Sort by total score, take top N
    highlights.sort(key=lambda h: h.total_score, reverse=True)
    return highlights[:top_n]


def clip_window(highlight: Highlight, tick_rate: int = 64) -> tuple[float, float]:
    """
    Returns (start_sec, end_sec) for the video clip of this highlight.
    Adds 4s before first kill and 3s after last kill.
    """
    pre  = 4.0   # seconds before first kill
    post = 3.0   # seconds after last kill
    start = max(0.0, highlight.start_tick / tick_rate - pre)
    end   = highlight.end_tick / tick_rate + post
    return round(start, 3), round(end, 3)
