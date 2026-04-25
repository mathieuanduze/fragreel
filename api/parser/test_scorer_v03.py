"""
Unit tests for scorer v0.3.0-alpha — clutch detection, bomb actions,
round-winning kill, and label composition.

No .dem file needed — uses mocked Kill / RoundState dataclasses.

Run from /api directory:
    python3 -m pytest parser/test_scorer_v03.py -v
or:
    python3 parser/test_scorer_v03.py
"""
from __future__ import annotations

import os
import sys

# Allow `from parser.x` imports when invoked as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parser.demo_parser import Kill, ParsedDemo, RoundState
from parser.scorer import (
    CLUTCH_BONUS,
    DEFUSE_BONUS,
    PLANT_WON_BONUS,
    ROUND_WINNING_KILL_BONUS,
    _detect_clutch,
    _enrich_with_round_context,
    _round_label,
    score_kills,
)

USER_SID  = "76561198000000001"
ALLY_SID  = "76561198000000010"
ENEMY_SID = "76561198000000002"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _kill(
    tick: int,
    weapon: str = "ak47",
    headshot: bool = False,
    round_num: int = 1,
    attacker: str = USER_SID,
    victim: str = ENEMY_SID,
    attacker_team: int = 2,    # team A (scorer logic is convention-agnostic)
    victim_team: int = 3,      # team B (scorer only checks attacker != victim)
) -> Kill:
    return Kill(
        tick=tick,
        timestamp=round(tick / 64.0, 3),
        round_num=round_num,
        weapon=weapon,
        headshot=headshot,
        attacker_steamid=attacker,
        victim_steamid=victim,
        attacker_team=attacker_team,
        victim_team=victim_team,
    )


def _make_parsed(
    user_kills: list[Kill],
    all_kills: list[Kill] | None = None,
    round_states: dict[int, RoundState] | None = None,
) -> ParsedDemo:
    return ParsedDemo(
        map_name="de_inferno",
        tickrate=64.0,
        duration=900.0,
        player_steamid=USER_SID,
        player_kills=user_kills,
        all_kills=all_kills if all_kills is not None else list(user_kills),
        ct_score=0,
        t_score=0,
        bomb_events=[],
        round_states=round_states or {},
    )


# ── Tests: clutch detection ───────────────────────────────────────────────────

def test_clutch_1v3_detected():
    """User is the last CT alive with 3 Ts remaining, kills all 3, wins round."""
    # Setup for 1v3: at moment user starts killing, CT=1 (only user) and T=3.
    # Timeline:
    #   tick 50, 70:  allies kill 2 Ts (T goes 5→3)
    #   tick 100-400: 4 allies die (CT goes 5→1, only user alive)
    #   tick 500-700: user kills 3 remaining Ts (T goes 3→0, CT wins)
    ally_kills_ts = [
        _kill(50, attacker=ALLY_SID, victim=ENEMY_SID,
              attacker_team=2, victim_team=3),
        _kill(70, attacker=ALLY_SID, victim=ENEMY_SID,
              attacker_team=2, victim_team=3),
    ]
    ally_deaths = [
        _kill(100 + i * 100, attacker=ENEMY_SID, victim=ALLY_SID,
              attacker_team=3, victim_team=2)
        for i in range(4)
    ]
    user_clutch_kills = [
        _kill(500 + i * 100, weapon="ak47") for i in range(3)
    ]
    all_round_kills = ally_kills_ts + ally_deaths + user_clutch_kills

    state = RoundState(
        round_num=1, winner_team=2, user_team=2, user_won=True,
    )

    result = _detect_clutch(user_clutch_kills, state, all_round_kills, USER_SID)
    assert result == "1v3", f"Expected '1v3', got {result!r}"
    print("  ✓ 1v3 clutch detected")


def test_clutch_1v5_detected():
    """User alive alone vs all 5 Ts at start of seq, kills all 5."""
    # No teammate kills before user's kills, but user team starts 5v5
    # and all 4 teammates die between user's first kill and... wait,
    # for 1v5 we need user to be ALONE before their first kill.
    # So 4 teammates die first.
    ally_deaths = [
        _kill(100 + i * 50, attacker=ENEMY_SID, victim=ALLY_SID,
              attacker_team=3, victim_team=2)
        for i in range(4)
    ]
    # User alive alone, kills all 5 Ts
    user_kills = [_kill(500 + i * 100) for i in range(5)]
    all_round_kills = ally_deaths + user_kills

    state = RoundState(round_num=1, winner_team=2, user_team=2, user_won=True)
    result = _detect_clutch(user_kills, state, all_round_kills, USER_SID)
    assert result == "1v5", f"Expected '1v5', got {result!r}"
    print("  ✓ 1v5 clutch detected")


def test_no_clutch_when_team_alive():
    """User has 3 kills but team still has another player alive."""
    # Only 2 ally deaths → CT alive 3 when user starts seq
    ally_deaths = [
        _kill(100, attacker=ENEMY_SID, victim=ALLY_SID,
              attacker_team=3, victim_team=2),
        _kill(200, attacker=ENEMY_SID, victim=ALLY_SID,
              attacker_team=3, victim_team=2),
    ]
    user_kills = [_kill(300 + i * 100) for i in range(3)]
    all_round_kills = ally_deaths + user_kills

    state = RoundState(round_num=1, winner_team=2, user_team=2, user_won=True)
    result = _detect_clutch(user_kills, state, all_round_kills, USER_SID)
    assert result is None, f"Expected None, got {result!r}"
    print("  ✓ no clutch when team has more than 1 alive")


def test_no_clutch_when_round_lost():
    """User is 1v3 but loses the round (e.g. didn't kill all enemies)."""
    ally_deaths = [
        _kill(100 + i * 50, attacker=ENEMY_SID, victim=ALLY_SID,
              attacker_team=3, victim_team=2)
        for i in range(4)
    ]
    user_kills = [_kill(500), _kill(600)]   # only 2 kills, not enough
    user_death = _kill(700, attacker=ENEMY_SID, victim=USER_SID,
                       attacker_team=3, victim_team=2)
    all_round_kills = ally_deaths + user_kills + [user_death]

    state = RoundState(round_num=1, winner_team=3, user_team=2, user_won=False)
    result = _detect_clutch(user_kills, state, all_round_kills, USER_SID)
    assert result is None, f"Expected None (round lost), got {result!r}"
    print("  ✓ no clutch when round lost")


def test_no_clutch_when_team_data_missing():
    """Graceful failure when victim_team is None on round kills."""
    user_kills = [_kill(500), _kill(600), _kill(700)]
    # Inject a kill with missing team info
    bad_kill = Kill(
        tick=100, timestamp=1.5625, round_num=1,
        weapon="ak47", headshot=False,
        attacker_steamid=ENEMY_SID, victim_steamid=ALLY_SID,
        attacker_team=None, victim_team=None,
    )
    all_round_kills = [bad_kill] + user_kills

    state = RoundState(round_num=1, winner_team=2, user_team=2, user_won=True)
    result = _detect_clutch(user_kills, state, all_round_kills, USER_SID)
    assert result is None, "Expected graceful None when team data missing"
    print("  ✓ graceful None when team data missing")


# ── Tests: bomb action ────────────────────────────────────────────────────────

def test_defuse_bonus_applied():
    """User defused the bomb on round their team won → bomb_action = defuse."""
    user_kills = [_kill(100)]
    state = RoundState(
        round_num=1, winner_team=2, user_team=2, user_won=True,
        bomb_defused_by=USER_SID,
    )
    parsed = _make_parsed(user_kills, round_states={1: state})

    ctx = _enrich_with_round_context(user_kills, parsed)
    assert ctx["bomb_action"] == "defuse"
    assert ctx["won_round"] is True
    print("  ✓ defuse action detected when user defused on winning round")


def test_plant_won_bonus_applied():
    """User planted the bomb on round their T team won → bomb_action = plant_won."""
    user_kills = [_kill(100, attacker_team=3, victim_team=2)]
    state = RoundState(
        round_num=1, winner_team=3, user_team=3, user_won=True,
        bomb_planted_by=USER_SID,
    )
    parsed = _make_parsed(user_kills, round_states={1: state})

    ctx = _enrich_with_round_context(user_kills, parsed)
    assert ctx["bomb_action"] == "plant_won"
    print("  ✓ plant_won action detected when T user planted + won")


def test_no_bomb_action_when_round_lost():
    """User defused but round was somehow lost (edge case) → no defuse bonus."""
    user_kills = [_kill(100)]
    state = RoundState(
        round_num=1, winner_team=3, user_team=2, user_won=False,
        bomb_defused_by=USER_SID,   # User attempted but team lost (unlikely but defensive)
    )
    parsed = _make_parsed(user_kills, round_states={1: state})

    ctx = _enrich_with_round_context(user_kills, parsed)
    assert ctx["bomb_action"] is None
    print("  ✓ no bomb action when round lost (even if user defused)")


# ── Tests: round-winning kill ─────────────────────────────────────────────────

def test_round_winning_kill_detected():
    """User's last kill in the round is also the LAST kill of the round → flagged."""
    user_kills = [_kill(100), _kill(200), _kill(500)]   # last kill at tick 500
    all_round_kills = list(user_kills)   # no kills after user's last

    state = RoundState(round_num=1, winner_team=2, user_team=2, user_won=True)
    parsed = _make_parsed(user_kills, all_kills=all_round_kills,
                          round_states={1: state})

    ctx = _enrich_with_round_context(user_kills, parsed)
    assert ctx["is_round_winning_kill"] is True
    print("  ✓ round-winning kill detected when user's last kill closes the round")


def test_round_winning_kill_NOT_flagged_when_teammate_finishes():
    """User killed at tick 200 but teammate finished at tick 600 → not flagged."""
    user_kills = [_kill(200)]
    teammate_finish = _kill(600, attacker=ALLY_SID, victim=ENEMY_SID,
                            attacker_team=2, victim_team=3)
    all_round_kills = [user_kills[0], teammate_finish]

    state = RoundState(round_num=1, winner_team=2, user_team=2, user_won=True)
    parsed = _make_parsed(user_kills, all_kills=all_round_kills,
                          round_states={1: state})

    ctx = _enrich_with_round_context(user_kills, parsed)
    assert ctx["is_round_winning_kill"] is False
    print("  ✓ not flagged when teammate finishes after user")


# ── Tests: label composition ──────────────────────────────────────────────────

def test_label_pure_4k():
    seq = [_kill(100 + i * 50, weapon="ak47") for i in range(4)]
    label = _round_label(4, seq, ctx={})
    assert label == "4K · Round 1", f"Got: {label}"
    print(f"  ✓ pure 4K → {label!r}")


def test_label_clutch_decoration():
    seq = [_kill(100 + i * 50, weapon="ak47") for i in range(3)]
    ctx = {"clutch_situation": "1v3", "won_round": True,
           "bomb_action": None, "is_round_winning_kill": True}
    label = _round_label(3, seq, ctx=ctx)
    assert label == "1v3 Clutch + 3K · Round 1", f"Got: {label}"
    print(f"  ✓ clutch + 3K → {label!r}")


def test_label_clutch_plus_defuse():
    seq = [_kill(100 + i * 50, weapon="m4a1") for i in range(3)]
    ctx = {"clutch_situation": "1v3", "won_round": True,
           "bomb_action": "defuse", "is_round_winning_kill": True}
    label = _round_label(3, seq, ctx=ctx)
    assert label == "1v3 Clutch + 3K + Defuse · Round 1", f"Got: {label}"
    print(f"  ✓ clutch + 3K + defuse → {label!r}")


def test_label_awp_2k_plus_plant():
    seq = [_kill(100, weapon="awp"), _kill(200, weapon="awp")]
    ctx = {"clutch_situation": None, "won_round": True,
           "bomb_action": "plant_won", "is_round_winning_kill": False}
    label = _round_label(2, seq, ctx=ctx)
    assert label == "AWP 2K + Plant · Round 1", f"Got: {label}"
    print(f"  ✓ AWP 2K + plant → {label!r}")


def test_label_solo_awp_hs():
    seq = [_kill(100, weapon="awp", headshot=True)]
    label = _round_label(1, seq, ctx={})
    assert "AWP" in label and "HS" in label, f"Got: {label}"
    print(f"  ✓ solo AWP HS → {label!r}")


# ── Tests: end-to-end score_kills with new bonuses ────────────────────────────

def test_clutch_bonus_added_to_score():
    """Scored highlight should include CLUTCH_BONUS for 1v3."""
    # Setup for 1v3: same as test_clutch_1v3_detected
    #   2 ally kills (T: 5→3) → 4 ally deaths (CT: 5→1) → user kills 3 Ts
    ally_kills_ts = [
        _kill(50, attacker=ALLY_SID, victim=ENEMY_SID,
              attacker_team=2, victim_team=3),
        _kill(70, attacker=ALLY_SID, victim=ENEMY_SID,
              attacker_team=2, victim_team=3),
    ]
    ally_deaths = [
        _kill(100 + i * 50, attacker=ENEMY_SID, victim=ALLY_SID,
              attacker_team=3, victim_team=2)
        for i in range(4)
    ]
    user_kills = [_kill(500 + i * 100, weapon="ak47") for i in range(3)]
    all_round_kills = ally_kills_ts + ally_deaths + user_kills

    state = RoundState(round_num=1, winner_team=2, user_team=2, user_won=True)
    parsed = _make_parsed(
        user_kills=user_kills,
        all_kills=all_round_kills,
        round_states={1: state},
    )

    highlights = score_kills(parsed)
    assert len(highlights) == 1
    h = highlights[0]
    assert h.clutch_situation == "1v3"
    assert h.won_round is True
    assert h.is_round_winning_kill is True   # last kill of round = user's last
    # Score should be: BASE(3K)=400 + CLUTCH(1v3)=700 + ROUND_WIN=150 = 1250 minimum
    expected_min = 400 + CLUTCH_BONUS["1v3"] + ROUND_WINNING_KILL_BONUS
    assert h.score >= expected_min, f"Score {h.score} < {expected_min}"
    print(f"  ✓ 1v3 clutch + 3K → label={h.label!r}, score={h.score}")


def test_defuse_bonus_added_to_score():
    """Defuse should add DEFUSE_BONUS = 200."""
    user_kills = [_kill(100, weapon="ak47")]
    state = RoundState(
        round_num=1, winner_team=2, user_team=2, user_won=True,
        bomb_defused_by=USER_SID,
    )
    parsed = _make_parsed(user_kills, round_states={1: state})

    highlights = score_kills(parsed)
    h = highlights[0]
    assert h.bomb_action == "defuse"
    # Score: BASE(1K)=30 + ROUND_WIN(150) + DEFUSE(200) = 380
    expected = 30 + ROUND_WINNING_KILL_BONUS + DEFUSE_BONUS
    assert h.score == expected, f"Expected {expected}, got {h.score}"
    print(f"  ✓ defuse bonus applied → score={h.score}")


def test_no_round_state_falls_back_gracefully():
    """When round_states is empty, scorer should still work (no clutch/bomb)."""
    user_kills = [_kill(100), _kill(200)]
    parsed = _make_parsed(user_kills, round_states={})   # empty

    highlights = score_kills(parsed)
    assert len(highlights) == 1
    h = highlights[0]
    assert h.clutch_situation is None
    assert h.bomb_action is None
    assert h.won_round is False
    assert h.is_round_winning_kill is False
    print(f"  ✓ no round state → graceful defaults, score={h.score}")


# ── Tests: round-based architecture (v0.3.0-alpha refactor) ──────────────────

def test_round_based_one_round_one_highlight_even_with_large_kill_gap():
    """
    Reproduces the JhonyPR R18 case from the matchmaking smoke test:
    2 user kills in the SAME round, but with a 50s gap between them.
    Old cluster-based scorer produced 2 highlights (both with plant_won bonus
    duplicated). Round-based must produce exactly 1 highlight with both kills
    aggregated and the bomb bonus applied ONCE.
    """
    # Both kills in round_num=1, but 50s apart (well above any gap threshold)
    user_kills = [
        _kill(tick=64 * 10,  weapon="ak47", round_num=1),  # ts ~10s
        _kill(tick=64 * 60,  weapon="ak47", round_num=1),  # ts ~60s
    ]
    state = RoundState(
        round_num=1, winner_team=2, user_team=2, user_won=True,
        bomb_planted_by=USER_SID,
    )
    parsed = _make_parsed(user_kills, round_states={1: state})

    highlights = score_kills(parsed)
    assert len(highlights) == 1, f"Expected 1 highlight per round, got {len(highlights)}"
    h = highlights[0]
    assert h.round_num == 1
    assert len(h.kills) == 2, f"Both kills should be in the single highlight, got {len(h.kills)}"
    assert h.bomb_action == "plant_won", "Plant bonus should fire once for the round"
    # Score: BASE(2K)=150 + RWK(150) + PLANT(150) = 450 minimum (no weapon/HS bonus on plain ak47)
    expected = 150 + ROUND_WINNING_KILL_BONUS + PLANT_WON_BONUS
    assert h.score == expected, f"Expected {expected} (single application of bonuses), got {h.score}"
    print(f"  ✓ 1 round = 1 highlight regardless of intra-round gap → score={h.score}")


def test_round_based_kill_ticks_populated_for_client_clustering():
    """
    The Highlight must expose kill_ticks and kill_timestamps so the client
    can apply its cluster algorithm (gap=10s, pad=±5s/±3.5s) locally.
    """
    user_kills = [
        _kill(tick=128,  weapon="awp", round_num=1),  # ts 2.0
        _kill(tick=512,  weapon="awp", round_num=1),  # ts 8.0
        _kill(tick=2048, weapon="awp", round_num=1),  # ts 32.0
    ]
    parsed = _make_parsed(user_kills, round_states={})

    highlights = score_kills(parsed)
    assert len(highlights) == 1
    h = highlights[0]
    assert h.kill_ticks == [128, 512, 2048], f"kill_ticks not populated: {h.kill_ticks}"
    assert len(h.kill_timestamps) == 3
    assert h.kill_timestamps[0] == 2.0
    print(f"  ✓ kill_ticks exposed for client → {h.kill_ticks}")


def test_round_based_multiple_rounds_each_one_highlight():
    """
    User plays 3 different rounds with kills. Should get 3 highlights, one
    per round, ranked by their round-level score (no cluster split).
    """
    user_kills = [
        # Round 1: 1 kill (low score)
        _kill(tick=100, weapon="glock", round_num=1),
        # Round 2: ACE (high score)
        _kill(tick=200, weapon="ak47", round_num=2),
        _kill(tick=210, weapon="ak47", round_num=2),
        _kill(tick=220, weapon="ak47", round_num=2),
        _kill(tick=230, weapon="ak47", round_num=2),
        _kill(tick=240, weapon="ak47", round_num=2),
        # Round 3: 2K (medium)
        _kill(tick=300, weapon="awp", round_num=3),
        _kill(tick=310, weapon="awp", round_num=3),
    ]
    parsed = _make_parsed(user_kills, round_states={})

    highlights = score_kills(parsed)
    assert len(highlights) == 3, f"Expected 3 round-highlights, got {len(highlights)}"
    # Top by score: ACE > AWP 2K > Glock 1K
    rounds_in_order = [h.round_num for h in highlights]
    assert rounds_in_order == [2, 3, 1], f"Ranking off: {rounds_in_order}"
    assert highlights[0].rank == 1 and highlights[2].rank == 3
    print(f"  ✓ 3 rounds → 3 ranked highlights → {rounds_in_order}")


def test_round_based_bomb_bonus_NOT_duplicated_across_intra_round_gaps():
    """
    Specifically guards against the bug found in smoke test:
    user plants the bomb AND has 2 kills (one before plant, one after, with
    a long gap). Old code duplicated PLANT_WON_BONUS on each cluster.
    Round-based must add it exactly once.
    """
    user_kills = [
        _kill(tick=64 * 5,  weapon="ak47", round_num=7),  # ts 5s
        _kill(tick=64 * 80, weapon="ak47", round_num=7),  # ts 80s
    ]
    state = RoundState(
        round_num=7, winner_team=3, user_team=3, user_won=True,
        bomb_planted_by=USER_SID,
    )
    parsed = _make_parsed(user_kills, round_states={7: state})

    highlights = score_kills(parsed)
    assert len(highlights) == 1
    h = highlights[0]
    # Score breakdown: BASE(2K)=150 + RWK=150 + PLANT_WON=150 = 450
    # Crucially NOT 150 + 2*150 + 2*150 = 750 (duplicated bonuses bug)
    expected = 150 + ROUND_WINNING_KILL_BONUS + PLANT_WON_BONUS
    assert h.score == expected, f"Bonus duplication bug: expected {expected}, got {h.score}"
    print(f"  ✓ plant_won bonus applied exactly once per round → score={h.score}")


# ── v0.3.0-beta-2 — sentinel pra cadeia scorer→demo.py→store→matches.py ─────

def test_bomb_action_tick_survives_persist_roundtrip():
    """Regression sentinel — saga 6334960 / c1ca4c6 / [demo.py fix] do v0.3.0-beta-2.

    Os bugs em sequência mostraram que cada elo da cadeia
    Highlight (dataclass) → match_doc dict (demo.py) → JSON store → load_match
    → _to_match_out → HighlightOut response **pode** dropar campos novos
    silenciosamente. Cada vez foi catched só no PC smoke test (custo ~30min de
    diagnóstico em produção). Este teste roda o roundtrip inteiro com mock
    minimal e fail-fast em CI/dev.

    Cobre: clutch_situation, won_round, bomb_action, is_round_winning_kill,
    kill_ticks, kill_timestamps, bomb_action_tick, bomb_action_timestamp.
    """
    import json
    import tempfile
    from pathlib import Path
    from parser.scorer import Highlight

    # Mock Highlight com TODOS os campos v0.3.0+ populados
    h = Highlight(
        rank=1, round_num=8, label="2K · 1v2 Clutch · Defuse",
        score=740.0, start=866.3, end=898.3,
        kills=[],
        clutch_situation="1v2",
        won_round=True,
        bomb_action="defuse",
        is_round_winning_kill=True,
        kill_ticks=[56404, 57174],
        kill_timestamps=[881.312, 893.344],
        bomb_action_tick=57550,
        bomb_action_timestamp=899.219,
    )

    # 1. Scorer → match_doc dict (mirror exato de routes/demo.py:109-137)
    #    Se demo.py adicionar/remover campo, espelhar aqui — TESTE TEM QUE BATER
    #    com a estrutura real ou fica falso-verde.
    match_doc = {
        "id": "test_match_v030beta2",
        "map": "de_inferno",
        "highlights": [
            {
                "rank":      h.rank,
                "round_num": h.round_num,
                "label":     h.label,
                "score":     h.score,
                "start":     h.start,
                "end":       h.end,
                "kills":     [],
                "clutch_situation":      h.clutch_situation,
                "won_round":             h.won_round,
                "bomb_action":           h.bomb_action,
                "is_round_winning_kill": h.is_round_winning_kill,
                "kill_ticks":            h.kill_ticks,
                "kill_timestamps":       h.kill_timestamps,
                "bomb_action_tick":      h.bomb_action_tick,
                "bomb_action_timestamp": h.bomb_action_timestamp,
            }
        ],
    }

    # 2. JSON store roundtrip (mock disco com tempfile)
    with tempfile.TemporaryDirectory() as tmp:
        store_path = Path(tmp) / "match.json"
        store_path.write_text(json.dumps(match_doc))
        loaded = json.loads(store_path.read_text())

    # 3. Roundtrip via _to_match_out
    from routes.matches import _to_match_out
    out = _to_match_out(loaded)

    h_out = out.highlights[0]
    # Assertions: cada campo crítico TEM que sobreviver
    assert h_out.clutch_situation == "1v2", f"clutch_situation lost: {h_out.clutch_situation}"
    assert h_out.won_round is True, f"won_round lost: {h_out.won_round}"
    assert h_out.bomb_action == "defuse", f"bomb_action lost: {h_out.bomb_action}"
    assert h_out.is_round_winning_kill is True, f"RWK lost"
    assert h_out.kill_ticks == [56404, 57174], f"kill_ticks lost: {h_out.kill_ticks}"
    assert h_out.kill_timestamps == [881.312, 893.344], f"kill_timestamps lost"
    # Os 2 campos do v0.3.0-beta-2 — historicamente onde a cadeia quebrou
    assert h_out.bomb_action_tick == 57550, (
        f"bomb_action_tick lost (THIS is the regression — check demo.py "
        f"match_doc dict + matches.py _to_match_out + scorer.py dataclass): "
        f"got {h_out.bomb_action_tick}"
    )
    assert h_out.bomb_action_timestamp == 899.219, (
        f"bomb_action_timestamp lost: got {h_out.bomb_action_timestamp}"
    )
    print("  ✓ all v0.3.0+ fields survive scorer→match_doc→store→_to_match_out roundtrip")


# ── Runner ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    tests = [
        # Clutch
        test_clutch_1v3_detected,
        test_clutch_1v5_detected,
        test_no_clutch_when_team_alive,
        test_no_clutch_when_round_lost,
        test_no_clutch_when_team_data_missing,
        # Bomb
        test_defuse_bonus_applied,
        test_plant_won_bonus_applied,
        test_no_bomb_action_when_round_lost,
        # Round-winning kill
        test_round_winning_kill_detected,
        test_round_winning_kill_NOT_flagged_when_teammate_finishes,
        # Labels
        test_label_pure_4k,
        test_label_clutch_decoration,
        test_label_clutch_plus_defuse,
        test_label_awp_2k_plus_plant,
        test_label_solo_awp_hs,
        # v0.3.0-beta-2 — persist roundtrip sentinel
        test_bomb_action_tick_survives_persist_roundtrip,
        # End-to-end
        test_clutch_bonus_added_to_score,
        test_defuse_bonus_added_to_score,
        test_no_round_state_falls_back_gracefully,
        # Round-based architecture (v0.3.0-alpha refactor)
        test_round_based_one_round_one_highlight_even_with_large_kill_gap,
        test_round_based_kill_ticks_populated_for_client_clustering,
        test_round_based_multiple_rounds_each_one_highlight,
        test_round_based_bomb_bonus_NOT_duplicated_across_intra_round_gaps,
    ]
    passed = 0
    failed = []
    for t in tests:
        name = t.__name__.replace("test_", "")
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {name} — {e}")
            failed.append(name)
        except Exception as e:
            import traceback
            print(f"  ERROR: {name} — {type(e).__name__}: {e}")
            traceback.print_exc()
            failed.append(name)
    print(f"\n{passed}/{len(tests)} passed")
    if failed:
        print(f"FAILED: {failed}")
        sys.exit(1)
