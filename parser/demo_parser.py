"""
Parses a CS2 .dem file and returns structured event data.
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Union
import json

try:
    from demoparser2 import DemoParser
    DEMOPARSER_AVAILABLE = True
except ImportError:
    DEMOPARSER_AVAILABLE = False


TICK_RATE = 64  # CS2 default; 128 on FACEIT


@dataclass
class KillEvent:
    tick: int
    timestamp_sec: float
    round_num: int
    killer: str
    killer_steamid: str
    victim: str
    victim_steamid: str
    weapon: str
    headshot: bool
    killer_hp: int        # HP of killer at moment of kill
    attacker_blind: bool  # killer was flashed
    noscope: bool
    thru_smoke: bool


@dataclass
class RoundResult:
    round_num: int
    winner_side: str  # "CT" or "T"
    ct_score: int
    t_score: int


@dataclass
class ParsedDemo:
    map_name: str
    tick_rate: int
    kills: list[KillEvent]
    rounds: list[RoundResult]
    player_stats: dict  # steamid -> {kills, deaths, hs, adr, ...}


def tick_to_seconds(tick: int, tick_rate: int = TICK_RATE) -> float:
    return round(tick / tick_rate, 3)


def parse(demo_path: Union[str, Path], player_steamid: Optional[str] = None) -> ParsedDemo:
    """
    Parse a CS2 demo file. If player_steamid is provided, filters events
    to only include kills where that player is the killer or victim.
    """
    if not DEMOPARSER_AVAILABLE:
        raise RuntimeError("demoparser2 not installed. Run: pip install demoparser2")

    path = Path(demo_path)
    if not path.exists():
        raise FileNotFoundError(f"Demo not found: {path}")

    parser = DemoParser(str(path))

    # ── Map info ─────────────────────────────────────────────────
    header = parser.parse_header()
    map_name = header.get("map_name", "unknown")

    # ── Kill events ───────────────────────────────────────────────
    kills_df = parser.parse_event(
        "player_death",
        player=["name", "steamid", "last_place_name"],
        other=[
            "weapon",
            "headshot",
            "attacker_blind",
            "noscope",
            "thru_smoke",
            "dmg_health",   # damage dealt on this kill
        ],
    )

    round_df = parser.parse_event("round_end", other=["winner", "ct_score", "t_score"])

    # ── Player stats (end of demo) ────────────────────────────────
    try:
        stats_df = parser.parse_ticks(
            ["kills_total", "deaths_total", "headshot_kills_total", "damage_total"],
            ticks=[kills_df["tick"].max()],
        )
    except Exception:
        stats_df = None

    # ── Build kill events ─────────────────────────────────────────
    kills: list[KillEvent] = []
    round_counter: dict[int, int] = {}  # tick -> round num (approximated below)

    # assign round numbers by bucketing ticks with round_end events
    round_end_ticks = sorted(round_df["tick"].tolist()) if len(round_df) else []

    def get_round(tick: int) -> int:
        for i, rt in enumerate(round_end_ticks):
            if tick <= rt:
                return i + 1
        return len(round_end_ticks) + 1

    for _, row in kills_df.iterrows():
        tick = int(row["tick"])

        # filter to target player if given
        killer_id = str(row.get("attacker_steamid", ""))
        victim_id  = str(row.get("user_steamid", ""))
        if player_steamid and player_steamid not in (killer_id, victim_id):
            continue

        kills.append(KillEvent(
            tick=tick,
            timestamp_sec=tick_to_seconds(tick),
            round_num=get_round(tick),
            killer=str(row.get("attacker_name", "")),
            killer_steamid=killer_id,
            victim=str(row.get("user_name", "")),
            victim_steamid=victim_id,
            weapon=str(row.get("weapon", "")),
            headshot=bool(row.get("headshot", False)),
            killer_hp=int(row.get("attacker_health", 100)),
            attacker_blind=bool(row.get("attacker_blind", False)),
            noscope=bool(row.get("noscope", False)),
            thru_smoke=bool(row.get("thru_smoke", False)),
        ))

    # ── Build round results ───────────────────────────────────────
    rounds: list[RoundResult] = []
    for i, (_, row) in enumerate(round_df.iterrows()):
        winner_val = int(row.get("winner", 0))
        rounds.append(RoundResult(
            round_num=i + 1,
            winner_side="CT" if winner_val == 3 else "T",
            ct_score=int(row.get("ct_score", 0)),
            t_score=int(row.get("t_score", 0)),
        ))

    # ── Player stats ──────────────────────────────────────────────
    player_stats: dict = {}
    if stats_df is not None:
        for _, row in stats_df.iterrows():
            sid = str(row.get("steamid", ""))
            player_stats[sid] = {
                "kills":   int(row.get("kills_total", 0)),
                "deaths":  int(row.get("deaths_total", 0)),
                "hs":      int(row.get("headshot_kills_total", 0)),
                "damage":  int(row.get("damage_total", 0)),
            }

    return ParsedDemo(
        map_name=map_name,
        tick_rate=TICK_RATE,
        kills=kills,
        rounds=rounds,
        player_stats=player_stats,
    )


def to_json(demo: ParsedDemo) -> str:
    """Serialize ParsedDemo to JSON (for sending to server)."""
    import dataclasses
    return json.dumps(dataclasses.asdict(demo), indent=2)
