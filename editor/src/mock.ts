import { Match, ReelProps, CardProps } from "./types";

// Mock de partida realista — ex: a de_dust2 22-kill do Mathieu
export const MOCK_MATCH: Match = {
  id: "demo-dust2-001",
  map: "de_dust2",
  date: "21 Abr 2026",
  score: "13-9",
  side: "CT",
  status: "ready",
  stats: {
    kd: "22/14",
    hs: "45%",
    adr: "86.4",
    rating: "1.32",
  },
  highlights: [
    {
      rank: 1,
      round_num: 14,
      label: "ACE · AK-47 · Long A",
      score: 98.5,
      start: 14 * 115,
      end: 14 * 115 + 12,
      kills: [
        { label: "HS · Long", weapon: "ak47", headshot: true, hp: 100 },
        { label: "HS · Pit", weapon: "ak47", headshot: true, hp: 100 },
        { label: "Body · Goose", weapon: "ak47", headshot: false, hp: 85 },
        { label: "HS · Cross", weapon: "ak47", headshot: true, hp: 100 },
        { label: "HS · Default", weapon: "ak47", headshot: true, hp: 92 },
      ],
      clip_url: null,
    },
    {
      rank: 2,
      round_num: 22,
      label: "Clutch 1v3 · AWP · B Site",
      score: 87.2,
      start: 22 * 115,
      end: 22 * 115 + 15,
      kills: [
        { label: "AWP · Tunnels", weapon: "awp", headshot: false, hp: 100 },
        { label: "AWP · Plat", weapon: "awp", headshot: true, hp: 100 },
        { label: "AWP · Doors", weapon: "awp", headshot: false, hp: 100 },
      ],
      clip_url: null,
    },
    {
      rank: 3,
      round_num: 7,
      label: "4K · M4A4 · Mid",
      score: 76.8,
      start: 7 * 115,
      end: 7 * 115 + 10,
      kills: [
        { label: "HS · Mid", weapon: "m4a4", headshot: true, hp: 100 },
        { label: "HS · Xbox", weapon: "m4a4", headshot: true, hp: 100 },
        { label: "Body · Doors", weapon: "m4a4", headshot: false, hp: 70 },
        { label: "HS · CT Spawn", weapon: "m4a4", headshot: true, hp: 100 },
      ],
      clip_url: null,
    },
  ],
};

export const MOCK_REEL_PROPS: ReelProps = {
  match: MOCK_MATCH,
  selectedRanks: [1, 2, 3],
  mood: "acao",
  playerName: "mathieu",
};

export const MOCK_CARD_PROPS: CardProps = {
  match: MOCK_MATCH,
  mood: "acao",
  playerName: "mathieu",
};
