// Espelho do MatchOut / HighlightOut do api/models.py
// Se mudar lá, atualizar aqui.
import type { Orientation } from "./theme";

export type Mood = "eletronica" | "acao" | "heroico" | "chill";

// Re-exporta pra quem importa só de types.
export type { Orientation };

export type Kill = {
  label: string;
  weapon: string;
  headshot: boolean;
  hp: number;
  // Tempo da kill em segundos relativo ao início do MATCH (mesma base de highlight.start/end).
  // Opcional: quando o parser não fornece, o editor estima distribuindo
  // uniformemente as N kills entre highlight.start e highlight.end.
  time?: number;
};

export type Highlight = {
  rank: number;
  round_num: number;
  label: string;
  score: number;
  start: number;
  end: number;
  kills: Kill[];
  clip_url?: string | null;
};

export type MatchStats = {
  kd: string;
  hs: string;
  adr: string;
  rating: string;
};

export type Match = {
  id: string;
  map: string;
  date: string;
  score: string;
  side: string;
  status: string;
  stats: MatchStats;
  highlights: Highlight[];
};

// Props passadas pro Remotion via --props
export type ReelProps = {
  match: Match;
  selectedRanks: number[]; // quais highlights entram no vídeo
  mood: Mood;
  playerName: string;
  // Orientação do vídeo de saída. Default vertical (formato story/reel).
  // horizontal usa 16:9 (1920x1080) — ideal pra YouTube/Twitch.
  orientation?: Orientation;
};

export type CardProps = {
  match: Match;
  playerName: string;
  mood: Mood;
};
