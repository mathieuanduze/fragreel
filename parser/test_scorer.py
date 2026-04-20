"""
Unit tests for the scoring algorithm. No .dem file needed.
Run: python3 -m pytest parser/test_scorer.py -v
  or: python3 parser/test_scorer.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from parser.demo_parser import KillEvent, ParsedDemo, RoundResult
from parser.scorer import score_kills, clip_window

PLAYER = "76561198000000001"

def make_kill(tick, weapon, headshot=False, hp=100, blind=False, noscope=False, smoke=False,
              round_num=1, victim="enemy") -> KillEvent:
    return KillEvent(
        tick=tick, timestamp_sec=tick/64, round_num=round_num,
        killer="Player", killer_steamid=PLAYER,
        victim=victim, victim_steamid="76561198000000002",
        weapon=weapon, headshot=headshot, killer_hp=hp,
        attacker_blind=blind, noscope=noscope, thru_smoke=smoke,
    )

def make_demo(kills: list[KillEvent]) -> ParsedDemo:
    rounds = {k.round_num for k in kills}
    return ParsedDemo(
        map_name="de_dust2", tick_rate=64,
        kills=kills,
        rounds=[RoundResult(r, "CT", 0, 0) for r in sorted(rounds)],
        player_stats={},
    )


def test_awp_headshot_scores_higher_than_rifle():
    demo = make_demo([
        make_kill(100, "awp", headshot=True,  round_num=1),
        make_kill(200, "ak47", headshot=False, round_num=2),
    ])
    results = score_kills(demo, PLAYER, top_n=5)
    awp_hs   = next(h for h in results if h.round_num == 1)
    rifle    = next(h for h in results if h.round_num == 2)
    assert awp_hs.total_score > rifle.total_score
    print(f"  AWP HS: {awp_hs.total_score:.1f}  |  AK47: {rifle.total_score:.1f}  ✓")


def test_ace_scores_highest():
    ace_kills = [make_kill(100 + i*64, "ak47", round_num=1) for i in range(5)]
    single    = [make_kill(200, "awp", headshot=True, round_num=2)]
    demo = make_demo(ace_kills + single)
    results = score_kills(demo, PLAYER, top_n=5)
    ace    = next(h for h in results if h.round_num == 1)
    single_h = next(h for h in results if h.round_num == 2)
    assert ace.total_score > single_h.total_score
    print(f"  ACE: {ace.total_score:.1f}  |  AWP HS: {single_h.total_score:.1f}  ✓")


def test_low_hp_kill_gets_bonus():
    normal = make_kill(100, "ak47", hp=100, round_num=1)
    clutch = make_kill(200, "ak47", hp=5,   round_num=2)
    demo = make_demo([normal, clutch])
    results = score_kills(demo, PLAYER)
    high_hp = next(h for h in results if h.round_num == 1)
    low_hp  = next(h for h in results if h.round_num == 2)
    assert low_hp.total_score > high_hp.total_score
    print(f"  Low HP (5): {low_hp.total_score:.1f}  |  Full HP: {high_hp.total_score:.1f}  ✓")


def test_knife_kill_scores_highest_single():
    kills = [
        make_kill(100, "knife",   round_num=1),
        make_kill(200, "awp",    headshot=True, round_num=2),
        make_kill(300, "ak47",   round_num=3),
    ]
    demo = make_demo(kills)
    results = score_kills(demo, PLAYER)
    scores = {h.round_num: h.total_score for h in results}
    assert scores[1] > scores[2] > scores[3]
    print(f"  Knife: {scores[1]:.1f}  |  AWP HS: {scores[2]:.1f}  |  AK47: {scores[3]:.1f}  ✓")


def test_top_n_returns_at_most_n():
    kills = [make_kill(100 + i*200, "ak47", round_num=i+1) for i in range(10)]
    demo = make_demo(kills)
    results = score_kills(demo, PLAYER, top_n=5)
    assert len(results) == 5
    print(f"  top_n=5, got {len(results)} results  ✓")


def test_clip_window_adds_pre_post():
    from parser.scorer import Highlight, ScoredKill
    h = Highlight(
        round_num=1, kills=[], total_score=50.0, label="TEST",
        start_tick=640, end_tick=1280,
    )
    start, end = clip_window(h, tick_rate=64)
    assert start == 6.0   # 640/64 - 4 = 10 - 4 = 6
    assert end   == 23.0  # 1280/64 + 3 = 20 + 3 = 23
    print(f"  Clip window: {start}s — {end}s  ✓")


def test_label_contains_weapon_and_hs():
    kill = make_kill(100, "awp", headshot=True)
    demo = make_demo([kill])
    results = score_kills(demo, PLAYER)
    label = results[0].kills[0].label
    assert "AWP" in label.upper()
    assert "HS" in label.upper()
    print(f"  Label: '{label}'  ✓")


if __name__ == "__main__":
    tests = [
        test_awp_headshot_scores_higher_than_rifle,
        test_ace_scores_highest,
        test_low_hp_kill_gets_bonus,
        test_knife_kill_scores_highest_single,
        test_top_n_returns_at_most_n,
        test_clip_window_adds_pre_post,
        test_label_contains_weapon_and_hs,
    ]
    passed = 0
    for t in tests:
        name = t.__name__.replace("test_", "").replace("_", " ")
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {name} — {e}")
        except Exception as e:
            print(f"  ERROR: {name} — {e}")
    print(f"\n{passed}/{len(tests)} testes passaram")
