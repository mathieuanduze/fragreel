"""
Usage:
  python3 scripts/parse_demo.py <demo.dem> <steamid>

Example:
  python3 scripts/parse_demo.py demos/match.dem 76561198012345678
"""
import sys, json
sys.path.insert(0, __import__("os").path.dirname(os.path.dirname(__file__)))
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from parser import parse, score_kills, clip_window


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 scripts/parse_demo.py <demo.dem> <steamid>")
        sys.exit(1)

    demo_path  = sys.argv[1]
    steamid    = sys.argv[2]
    top_n      = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    print(f"\nParsing: {demo_path}")
    demo = parse(demo_path, player_steamid=steamid)
    print(f"Map: {demo.map_name}  |  Total kills by player: {len(demo.kills)}  |  Rounds: {len(demo.rounds)}")

    print(f"\nTop {top_n} highlights:\n")
    highlights = score_kills(demo, steamid, top_n=top_n)

    for i, h in enumerate(highlights, 1):
        start, end = clip_window(h, demo.tick_rate)
        duration = round(end - start, 1)
        kills_desc = " + ".join(k.label for k in h.kills)
        print(f"  #{i}  Round {h.round_num:>2}  [{start:.1f}s — {end:.1f}s  ({duration}s)]  score={h.total_score:.0f}")
        print(f"       {kills_desc}")
        print()

    # Save JSON for server
    out = {
        "map": demo.map_name,
        "player_steamid": steamid,
        "highlights": [
            {
                "rank": i + 1,
                "round": h.round_num,
                "score": h.total_score,
                "label": h.label,
                "clip_start_sec": clip_window(h, demo.tick_rate)[0],
                "clip_end_sec":   clip_window(h, demo.tick_rate)[1],
                "kills": [
                    {"weapon": k.kill.weapon, "headshot": k.kill.headshot,
                     "hp": k.kill.killer_hp, "score": k.score, "label": k.label}
                    for k in h.kills
                ],
            }
            for i, h in enumerate(highlights)
        ],
    }
    out_path = demo_path.replace(".dem", "_highlights.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Highlights saved to: {out_path}")


if __name__ == "__main__":
    main()
