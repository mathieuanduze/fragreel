"""
Mock match data — replaced by real parser output once client sends demos.
"""
from models import MatchSummary, MatchOut, MatchStats, HighlightOut, KillOut

MOCK_MATCHES: list[MatchSummary] = [
    MatchSummary(
        id="match-001",
        map="de_dust2",
        date="Hoje, 21:14",
        score="13–7",
        side="CT",
        status="ready",
        highlights_count=5,
        top_play="ACE · M4A1-S · Round 19",
        rating="1.42",
        kd="24/11",
    ),
    MatchSummary(
        id="match-002",
        map="de_inferno",
        date="Hoje, 19:02",
        score="16–14",
        side="T",
        status="ready",
        highlights_count=3,
        top_play="CLUTCH 1v3 · AWP · Round 26",
        rating="1.08",
        kd="18/16",
    ),
    MatchSummary(
        id="match-003",
        map="de_mirage",
        date="Ontem, 23:45",
        score="8–16",
        side="CT",
        status="processing",
        highlights_count=0,
        top_play="—",
        rating="0.87",
        kd="14/19",
    ),
    MatchSummary(
        id="match-004",
        map="de_nuke",
        date="Ontem, 21:30",
        score="16–10",
        side="T",
        status="ready",
        highlights_count=4,
        top_play="KNIFE KILL · Pistol Round",
        rating="1.31",
        kd="22/12",
    ),
]

MOCK_MATCH_DETAIL: dict[str, MatchOut] = {
    "match-001": MatchOut(
        id="match-001",
        map="de_dust2",
        date="Hoje, 21:14",
        score="13–7",
        side="CT",
        status="ready",
        stats=MatchStats(kd="24/11", hs="58%", adr="98.4", rating="1.42"),
        highlights=[
            HighlightOut(
                rank=1, round_num=19, label="ACE · M4A1-S · Round 19",
                score=275, start=1423.5, end=1451.2,
                kills=[
                    KillOut(label="M4A1-S · HS", weapon="M4A1-S", headshot=True, hp=87),
                    KillOut(label="M4A1-S", weapon="M4A1-S", headshot=False, hp=72),
                    KillOut(label="M4A1-S · HS", weapon="M4A1-S", headshot=True, hp=60),
                    KillOut(label="M4A1-S", weapon="M4A1-S", headshot=False, hp=44),
                    KillOut(label="M4A1-S · HS · 30HP", weapon="M4A1-S", headshot=True, hp=30),
                ],
            ),
            HighlightOut(
                rank=2, round_num=7, label="CLUTCH 1v3 · AWP · Round 7",
                score=182, start=542.1, end=558.8,
                kills=[
                    KillOut(label="AWP · HS · 18HP", weapon="AWP", headshot=True, hp=18),
                    KillOut(label="AWP · 15HP", weapon="AWP", headshot=False, hp=15),
                    KillOut(label="AWP · HS · 12HP", weapon="AWP", headshot=True, hp=12),
                ],
            ),
            HighlightOut(
                rank=3, round_num=14, label="3K · AK-47 · Round 14",
                score=90, start=1102.4, end=1117.0,
                kills=[
                    KillOut(label="AK-47 · HS", weapon="AK-47", headshot=True, hp=100),
                    KillOut(label="AK-47 · HS", weapon="AK-47", headshot=True, hp=95),
                    KillOut(label="AK-47", weapon="AK-47", headshot=False, hp=88),
                ],
            ),
            HighlightOut(
                rank=4, round_num=3, label="KNIFE KILL · Pistol Round 3",
                score=45, start=201.0, end=210.5,
                kills=[KillOut(label="KNIFE", weapon="Knife", headshot=False, hp=55)],
            ),
            HighlightOut(
                rank=5, round_num=22, label="2K · AWP · Round 22",
                score=38, start=1788.3, end=1798.1,
                kills=[
                    KillOut(label="AWP", weapon="AWP", headshot=False, hp=100),
                    KillOut(label="AWP · HS", weapon="AWP", headshot=True, hp=97),
                ],
            ),
        ],
    ),
}
