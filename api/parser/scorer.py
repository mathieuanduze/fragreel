"""
Highlight scorer — ranks ROUNDS by user performance.

Architecture (v0.3.0-alpha — round-based scoring, since 2026-04-24):
  • 1 highlight = 1 ROUND (not cluster). Score sums all kill contributions
    + round-level bonuses (clutch / bomb / RWK) for that round.
  • The scorer does NOT cluster kills by time anymore. The CLIENT
    (capture_script) receives kill_ticks for each selected round and applies
    cluster gap=10s pad=±5s/±3.5s to decide which sub-segments to capture.
  • Remotion does NOT cut temporally — only composes the captured clipes.

Why round-based: matches user mental model ("a round is a unit of play"),
prevents bonus duplication when a round has multiple kill clusters, and
keeps the UI simple (1 card per round in the pre-selection grid).

Scoring criteria (v0.3.0-alpha — scoring v2):
  - Multi-kill base score:  1k=30, 2k=150, 3k=400, 4k=700, 5k=1000
  - AWP / Scout bonus:      +50 per kill
  - Knife bonus:            +100 per kill
  - Headshot bonus:         +20 per kill
  - Desert Eagle bonus:     +20 per kill
  - 1v2 clutch (won round): +300
  - 1v3 clutch (won round): +700
  - 1v4 clutch (won round): +1200
  - 1v5 clutch (won round): +2000
  - Round-winning kill:     +150
  - CT defuse + won:        +200
  - T plant + won:          +150

Round capture window:
  start = first_kill_timestamp - ROUND_PRE_BUFFER
  end   = last_kill_timestamp  + ROUND_POST_BUFFER
The client uses (kill_ticks, kill_timestamps) to apply the cluster algorithm
locally (gap_threshold=10s, pad_pre=5s, pad_post=3.5s).
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

from parser.demo_parser import Kill, ParsedDemo, RoundState

log = logging.getLogger("fragreel.scorer")

# ── Constants ─────────────────────────────────────────────────────────────────

# Round capture window padding (server-side, generous; client trims to clusters)
ROUND_PRE_BUFFER  = 15.0   # seconds before first user kill (covers freezetime tail)
ROUND_POST_BUFFER = 5.0    # seconds after last user kill (covers death/explosion)
MIN_CLIP_LEN  = 6.0        # minimum clip length in seconds
MAX_HIGHLIGHTS = 10        # max highlights (= rounds) returned

BASE_SCORE: dict[int, int] = {1: 30, 2: 150, 3: 400, 4: 700, 5: 1000}
HS_BONUS = 20

# Weapons with bonus points (lowercase, no "weapon_" prefix)
WEAPON_BONUS: dict[str, int] = {
    "awp": 50, "ssg08": 30,
    "knife": 100, "bayonet": 100, "knife_t": 100, "knifegg": 100,
    "deagle": 20, "revolver": 20,
}

# v0.3.0-alpha — clutch + bomb bonuses
CLUTCH_BONUS: dict[str, int] = {"1v2": 300, "1v3": 700, "1v4": 1200, "1v5": 2000}
ROUND_WINNING_KILL_BONUS = 150
DEFUSE_BONUS  = 200   # CT user defused on round their team won
PLANT_WON_BONUS = 150  # T user planted and team held round

# v0.3.1 — Cinema events bonuses (B4 do roadmap pós-v0.3.0).
# Pesos calibrados em discussion com Mathieu durante research v0.3 cluster
# tuning (25/04). Magnitudes baixas (5-50 pts) — não devem dominar score
# em rounds banais, só puxar pra cima rounds com signature de "cinema-worthy"
# events. Comparativo: HS_BONUS=20, CLUTCH_1v3=700, RWK=150.
THRUSMOKE_BONUS  = 50  # kill através de smoke — alto valor narrativo
NOSCOPE_BONUS    = 40  # AWP no-scope — clip-worthy mesmo solo
WALLBANG_BONUS   = 30  # kill com penetração de wall
BLIND_KILL_BONUS = 30  # attacker estava cego (flashed) — pure muscle memory
LOW_HP_BONUS     = 20  # attacker com HP < 20 (kill heroico)
LOW_HP_THRESHOLD = 20

# Standard CS round size — assumed 5v5 at round_start. Legitimate edge cases
# (5v4 due to disconnect mid-round) cause approximate alive counts; clutch
# detection is best-effort. If team data is missing entirely, clutch detection
# returns None gracefully.
TEAM_SIZE = 5


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class KillInfo:
    label: str
    weapon: str
    headshot: bool
    hp: int = 0


@dataclass
class Highlight:
    """
    A round-level highlight. One Highlight = one round of play by the user.

    The `start`/`end` define the GENEROUS round capture window (covers freezetime
    tail through round_end). The CLIENT uses `kill_ticks` and `kill_timestamps`
    to apply the cluster algorithm (gap=10s, pad=±5s/±3.5s) and decide which
    sub-segments within [start, end] to actually capture.
    """
    rank: int
    round_num: int
    label: str
    score: float
    start: float                  # round capture window start (seconds from demo start)
    end: float                    # round capture window end
    kills: list[KillInfo] = field(default_factory=list)
    # v0.3.0-alpha — scoring v2 context (per round)
    clutch_situation: Optional[str] = None       # "1v2", "1v3", "1v4", "1v5"
    won_round: bool = False
    bomb_action: Optional[str] = None            # "defuse" | "plant_won"
    is_round_winning_kill: bool = False
    # v0.3.0-alpha round-based — for client-side capture clustering
    kill_ticks: list[int] = field(default_factory=list)
    kill_timestamps: list[float] = field(default_factory=list)
    # v0.3.0-beta-2 — bomb event tick (back-calc anim window in client v2 algo)
    # Hotfix urgente: faltava no commit 6334960 — Highlight.__init__ crashava
    # com TypeError "unexpected keyword argument 'bomb_action_tick'" porque
    # _enrich_with_round_context.scorer passava o kwarg mas o dataclass não
    # tinha o slot. Catch silencioso em demo.py escondia o erro como
    # status=queued/highlights=0. Caught no smoke test do PC (25/04 madrugada).
    bomb_action_tick: Optional[int] = None
    bomb_action_timestamp: Optional[float] = None


# ── Public API ────────────────────────────────────────────────────────────────

def score_kills(parsed: ParsedDemo, player_steamid: Optional[str] = None) -> list[Highlight]:
    """
    Score and rank user-played ROUNDS into highlights.

    Returns up to MAX_HIGHLIGHTS highlights, sorted best first. Each highlight
    represents ONE round where the user got at least one kill. Score is the
    round's total (kill contributions + round-level bonuses).

    The client receives `kill_ticks`/`kill_timestamps` and applies the cluster
    algorithm locally — the scorer no longer does cluster grouping.
    """
    kills = parsed.player_kills
    if not kills:
        log.info("No kills to score")
        return []

    # Group kills by round (preserve chronological order within each round)
    by_round: dict[int, list[Kill]] = defaultdict(list)
    for k in sorted(kills, key=lambda k: k.tick):
        by_round[k.round_num].append(k)

    log.info(f"Scoring {len(kills)} kills across {len(by_round)} rounds")

    scored: list[Highlight] = [
        _score_round(round_kills, round_num, parsed)
        for round_num, round_kills in by_round.items()
    ]

    # Sort by score descending and assign final ranks
    scored.sort(key=lambda h: h.score, reverse=True)
    for rank, hl in enumerate(scored, 1):
        hl.rank = rank

    return scored[:MAX_HIGHLIGHTS]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _score_round(round_kills: list[Kill], round_num: int, parsed: ParsedDemo) -> Highlight:
    """Score one round. round_kills is the user's kills in this round, chrono."""
    n          = len(round_kills)
    base       = BASE_SCORE.get(min(n, 5), 1000)
    bonus      = 0
    kill_infos: list[KillInfo] = []

    for kill in round_kills:
        wep_lower    = kill.weapon.lower()
        wep_bonus    = next((pts for key, pts in WEAPON_BONUS.items() if key in wep_lower), 0)
        hs_bonus_pts = HS_BONUS if kill.headshot else 0
        bonus       += wep_bonus + hs_bonus_pts

        kill_infos.append(KillInfo(
            label=_kill_label(kill),
            weapon=kill.weapon,
            headshot=kill.headshot,
        ))

    # ── Round-level context bonuses (each fires AT MOST ONCE per round) ───────
    ctx = _enrich_with_round_context(round_kills, parsed)

    if ctx["clutch_situation"]:
        bonus += CLUTCH_BONUS.get(ctx["clutch_situation"], 0)
    if ctx["is_round_winning_kill"]:
        bonus += ROUND_WINNING_KILL_BONUS
    if ctx["bomb_action"] == "defuse":
        bonus += DEFUSE_BONUS
    elif ctx["bomb_action"] == "plant_won":
        bonus += PLANT_WON_BONUS

    # v0.3.1 — Cinema events bonus (B4). Cada bonus dispara AT MOST ONCE
    # por round (any() em vez de soma per-kill) pra não inflacionar rounds
    # com múltiplas kills do mesmo tipo. Defaults graceful: kills sem flags
    # (demos pré-v0.3.1) retornam False/0/None → no bonus aplicado.
    if any(getattr(k, "thrusmoke", False) for k in round_kills):
        bonus += THRUSMOKE_BONUS
    if any(getattr(k, "noscope", False) for k in round_kills):
        bonus += NOSCOPE_BONUS
    if any(getattr(k, "penetrated", 0) > 0 for k in round_kills):
        bonus += WALLBANG_BONUS
    if any(getattr(k, "attackerblind", False) for k in round_kills):
        bonus += BLIND_KILL_BONUS
    if any(
        getattr(k, "attacker_health", None) is not None
        and k.attacker_health < LOW_HP_THRESHOLD
        for k in round_kills
    ):
        bonus += LOW_HP_BONUS

    score = float(base + bonus)

    # Round capture window — generous, client trims to actual clusters
    start = max(0.0, round(round_kills[0].timestamp - ROUND_PRE_BUFFER, 1))
    end   = round(round_kills[-1].timestamp + ROUND_POST_BUFFER, 1)
    if end - start < MIN_CLIP_LEN:
        end = round(start + MIN_CLIP_LEN, 1)

    return Highlight(
        rank=0,  # set by score_kills after sorting
        round_num=round_num,
        label=_round_label(n, round_kills, ctx),
        score=round(score, 1),
        start=start,
        end=end,
        kills=kill_infos,
        clutch_situation=ctx["clutch_situation"],
        won_round=ctx["won_round"],
        bomb_action=ctx["bomb_action"],
        is_round_winning_kill=ctx["is_round_winning_kill"],
        kill_ticks=[k.tick for k in round_kills],
        kill_timestamps=[k.timestamp for k in round_kills],
        bomb_action_tick=ctx.get("bomb_action_tick"),
        bomb_action_timestamp=ctx.get("bomb_action_timestamp"),
    )


# ── v0.3.0-alpha — round context enrichment ───────────────────────────────────

def _enrich_with_round_context(seq: list[Kill], parsed: ParsedDemo) -> dict:
    """
    Compute clutch_situation, won_round, bomb_action, is_round_winning_kill
    for the given highlight sequence, using the round_states + all_kills
    parsed from the demo.

    Returns dict with all 4 keys (None / False if undetermined / not applicable).
    """
    ctx = {
        "clutch_situation": None,
        "won_round": False,
        "bomb_action": None,
        "is_round_winning_kill": False,
        # v0.3.0-beta-2 — bomb event tick (back-calculated to animation start
        # by the client; here we store the COMPLETION tick from the demo)
        "bomb_action_tick": None,
        "bomb_action_timestamp": None,
    }

    if not seq:
        return ctx

    round_num = seq[0].round_num
    state: Optional[RoundState] = parsed.round_states.get(round_num)
    if state is None:
        return ctx

    ctx["won_round"] = bool(state.user_won)
    user_steamid = parsed.player_steamid

    # ── Bomb action (only counts if user did it AND team won the round) ───────
    if state.user_won and user_steamid:
        if state.bomb_defused_by == user_steamid:
            ctx["bomb_action"] = "defuse"
        elif state.bomb_planted_by == user_steamid:
            ctx["bomb_action"] = "plant_won"

        # v0.3.0-beta-2 — find the actual completion tick of the bomb event
        # so client can back-calc animation window. Looks up bomb_events parsed
        # from the demo; matches by round_num + action + steamid.
        if ctx["bomb_action"]:
            target_action = "defused" if ctx["bomb_action"] == "defuse" else "planted"
            for be in parsed.bomb_events:
                if (
                    be.round_num == round_num
                    and be.action == target_action
                    and be.player_steamid == user_steamid
                ):
                    ctx["bomb_action_tick"] = int(be.tick)
                    ctx["bomb_action_timestamp"] = float(be.timestamp)
                    break

    # ── Round-winning kill: last kill of the round AND killer's team won ──────
    if state.user_won and user_steamid:
        round_kills_chrono = sorted(
            (k for k in parsed.all_kills if k.round_num == round_num),
            key=lambda k: k.tick,
        )
        if round_kills_chrono:
            last_kill = round_kills_chrono[-1]
            # The seq is filtered to user-only kills, so seq[-1] is user's last
            # kill in this round. If seq[-1] is also the LAST kill of the round
            # (no enemy/teammate kill came after), it's the round-winning kill.
            if (
                last_kill.attacker_steamid == user_steamid
                and last_kill.tick == seq[-1].tick
            ):
                ctx["is_round_winning_kill"] = True

    # ── 1vN clutch detection ──────────────────────────────────────────────────
    ctx["clutch_situation"] = _detect_clutch(seq, state, parsed.all_kills, user_steamid)

    return ctx


def _detect_clutch(
    seq: list[Kill],
    state: RoundState,
    all_kills: list[Kill],
    user_steamid: str,
) -> Optional[str]:
    """
    Detect 1vN clutch — outcome-based, NOT cluster-position-based.

    A clutch is "user becomes last alive on his team mid-round, with N≥2 enemies
    still alive, AND user kills all N of them to close the round". This handles
    the realistic case the original logic missed:

        Round trace example:
          R7  3v3 (start of contact, user kills 1)  → 3v2
          R7  user's teammate dies                  → 2v2
          R7  user's other teammate dies            → 1v2  ← clutch begins HERE
          R7  user kills enemy                      → 1v1
          R7  user kills last enemy                 → 1v0  ← clutch closed

        That's a 1v2 clutch even though user's `seq` cluster started when the
        team was still 3v3. The OLD code looked at alive snapshot at seq[0]
        (=3v3) and rejected.

    Algorithm:
      1. Walk round kills chronologically maintaining alive counts (start 5v5).
      2. After each kill, check if user_alive transitioned to 1 AND user is
         still alive AND enemy_alive >= 2 → mark clutch_start_tick + N.
      3. From clutch_start onwards, count enemies the USER personally kills.
      4. If user kills all N enemies (alive_enemy reaches 0 with user still
         alive) AND state.user_won → return f"1v{N}".

    Returns "1v2", "1v3", "1v4", "1v5" or None. Defensive: returns None if
    team data is missing on any round kill, or if user_team is unknown.
    """
    if not state.user_won or state.user_team is None or not user_steamid:
        return None

    user_team  = state.user_team
    enemy_team = 3 if user_team == 2 else 2

    round_kills = sorted(
        (k for k in all_kills if k.round_num == seq[0].round_num),
        key=lambda k: k.tick,
    )
    if not round_kills:
        return None

    # Need team info on every round kill to count alive accurately
    if any(k.victim_team is None for k in round_kills):
        return None

    alive_user        = TEAM_SIZE
    alive_enemy       = TEAM_SIZE
    user_is_alive     = True
    clutch_n          = None     # number of enemies alive WHEN user became last
    user_enemy_kills_during_clutch = 0

    for k in round_kills:
        # Apply this kill's effect on alive counts FIRST
        if k.victim_team == user_team:
            alive_user -= 1
            if k.victim_steamid == user_steamid:
                user_is_alive = False
        elif k.victim_team == enemy_team:
            alive_enemy -= 1

        # Detect transition: user just became sole survivor on his team
        # (and is himself alive — i.e. it was a teammate who just died)
        if clutch_n is None and alive_user == 1 and user_is_alive and alive_enemy >= 2:
            clutch_n = alive_enemy
            # Don't count the kill that triggered detection if it was by user
            # (it was a teammate's death; user couldn't have killed his own teammate)
            continue

        # During clutch: count user's kills against enemies
        if clutch_n is not None and k.attacker_steamid == user_steamid \
                and k.victim_team == enemy_team:
            user_enemy_kills_during_clutch += 1

    # No clutch setup happened at all
    if clutch_n is None:
        return None

    # User must have personally killed all N enemies that were alive at clutch start
    if user_enemy_kills_during_clutch < clutch_n:
        return None

    # And the round must have ended with no enemies alive
    # (user_won is already True from guard at top, but double-check enemies dead)
    if alive_enemy > 0:
        # Round won via bomb/timer with enemies still alive — not a kill clutch
        return None

    n = min(clutch_n, 5)
    return f"1v{n}" if n in (2, 3, 4, 5) else None


def _kill_label(kill: Kill) -> str:
    """Human-readable label for a single kill."""
    weapon = _weapon_display(kill.weapon)
    parts  = [weapon]
    if kill.headshot:
        parts.append("HS")
    return " · ".join(parts)


def _round_label(n: int, round_kills: list[Kill], ctx: Optional[dict] = None) -> str:
    """
    Label for a round-level highlight.

    v0.3.0-alpha (round-based): composes clutch + base + bomb info, e.g.:
      "1v3 Clutch + 4K + Defuse · Round 12"
      "AWP 2K + Plant · Round 7"
      "Knife · Round 3"
    """
    ctx = ctx or {}
    weapons = [k.weapon.lower() for k in round_kills]
    round_n = round_kills[0].round_num
    seq = round_kills  # local alias; existing logic uses `seq`

    # Base "kill count" or weapon-flavored part
    if n >= 5:
        base_part = "ACE"
    elif n == 4:
        base_part = "4K"
    elif n == 3:
        base_part = "3K"
    elif n == 2:
        base_part = "2K"
    elif n == 1 and seq[0].headshot:
        base_part = f"{_weapon_display(seq[0].weapon)} · HS"
    else:
        base_part = _weapon_display(seq[0].weapon)

    # Special weapon flavours decorate the base for n>=2
    if n >= 2:
        if any("knife" in w for w in weapons):
            base_part = f"Knife {base_part}"
        elif all(w in ("awp", "ssg08") for w in weapons):
            base_part = f"AWP {base_part}"

    # Decorations from round context
    parts: list[str] = []
    if ctx.get("clutch_situation"):
        parts.append(f"{ctx['clutch_situation']} Clutch")
    parts.append(base_part)
    if ctx.get("bomb_action") == "defuse":
        parts.append("Defuse")
    elif ctx.get("bomb_action") == "plant_won":
        parts.append("Plant")

    return " + ".join(parts) + f" · Round {round_n}"


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
