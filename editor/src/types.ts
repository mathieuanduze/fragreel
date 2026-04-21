// Espelho do MatchOut / HighlightOut do api/models.py
// Se mudar lá, atualizar aqui.

export type Mood = "eletronica" | "acao" | "heroico" | "chill";

export type Kill = {
  label: string;
  weapon: string;
  headshot: boolean;
  hp: number;
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
};

export type CardProps = {
  match: Match;
  playerName: string;
  mood: Mood;
};
