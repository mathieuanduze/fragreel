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
  // Round 4c Fase 1.23 — narrative context pro título dinâmico
  // (Mathieu spec: "imita CS HUD"). Editor mostra
  // "{alive_ct_after}v{alive_t_after} · {attacker_health}HP" evoluindo
  // dinamicamente com cada kill. Todos opcionais — fallback pro
  // "{N} KILLS" da Fase 1.21 quando undefined (highlights legados).
  attacker_health?: number;
  alive_ct_after?: number;
  alive_t_after?: number;
};

export type Highlight = {
  rank: number;
  round_num: number;
  label: string;
  score: number;
  start: number;
  end: number;
  kills: Kill[];
  // clip_url — legado, usado quando o pipeline de screen capture (Round 3)
  // estava produzindo MP4 público por highlight. Mantido por compat.
  clip_url?: string | null;
  // gameplayVideoSrc — novo, vem do hlae_runner.py no PC do user.
  // Path local (file://) ou URL — Remotion <OffthreadVideo> resolve os dois.
  // Cada highlight recebe seu próprio .mov ProRes 4444 1920×1080 @ 300fps,
  // começando no frame 0 do highlight (sem offset).
  // Quando definido, sobrepõe placeholder e clip_url.
  gameplayVideoSrc?: string | null;
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
  // Round 4c Fase 1.17 — toggle de música de fundo controlado pelo usuário
  // no match-page (UI). Game audio (tiros/passos/voice) sempre presente,
  // só a trilha mood que pode ser muted. Default true. Quando false, o
  // <Audio> da trilha não é renderizado — só o áudio do <OffthreadVideo>.
  musicEnabled?: boolean;
};

export type CardProps = {
  match: Match;
  playerName: string;
  mood: Mood;
};
