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
      // 5 kills no ace — não uniformes (ritmo realista de spray + reposição):
      // 0.4s primeira (peek), 1.2s segunda (next angle), 4.5s terceira (espera),
      // 5.1s quarta (rápida), 7.8s quinta (last man).
      kills: [
        { label: "HS · Long", weapon: "ak47", headshot: true, hp: 100, time: 14 * 115 + 0.4 },
        { label: "HS · Pit", weapon: "ak47", headshot: true, hp: 100, time: 14 * 115 + 1.2 },
        { label: "Body · Goose", weapon: "ak47", headshot: false, hp: 85, time: 14 * 115 + 4.5 },
        { label: "HS · Cross", weapon: "ak47", headshot: true, hp: 100, time: 14 * 115 + 5.1 },
        { label: "HS · Default", weapon: "ak47", headshot: true, hp: 92, time: 14 * 115 + 7.8 },
      ],
      clip_url: null,
      // Mock: vídeo Pexels público pra dev no Mac sem precisar do .mov real
      // do HLAE. Só o highlight #1 tem — assim valido OffthreadVideo aqui e
      // fallback gradient nos #2 e #3 no mesmo render.
      // Quando o pipeline real rodar no PC, hlae_runner.py preenche este
      // campo com path local file:// pro ProRes 4444.
      gameplayVideoSrc:
        "https://videos.pexels.com/video-files/1409899/1409899-hd_1920_1080_25fps.mp4",
    },
    {
      rank: 2,
      round_num: 22,
      label: "Clutch 1v3 · AWP · B Site",
      score: 87.2,
      start: 22 * 115,
      end: 22 * 115 + 15,
      // Clutch 1v3 com AWP — kills bem espaçadas (reposição, tempo de scope).
      kills: [
        { label: "AWP · Tunnels", weapon: "awp", headshot: false, hp: 100, time: 22 * 115 + 1.5 },
        { label: "AWP · Plat", weapon: "awp", headshot: true, hp: 100, time: 22 * 115 + 6.2 },
        { label: "AWP · Doors", weapon: "awp", headshot: false, hp: 100, time: 22 * 115 + 11.0 },
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
      // 4K rápido — kills em ~3s (peek-shoot-flick).
      kills: [
        { label: "HS · Mid", weapon: "m4a4", headshot: true, hp: 100, time: 7 * 115 + 0.6 },
        { label: "HS · Xbox", weapon: "m4a4", headshot: true, hp: 100, time: 7 * 115 + 1.4 },
        { label: "Body · Doors", weapon: "m4a4", headshot: false, hp: 70, time: 7 * 115 + 2.1 },
        { label: "HS · CT Spawn", weapon: "m4a4", headshot: true, hp: 100, time: 7 * 115 + 3.4 },
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
