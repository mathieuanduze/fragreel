// Design tokens — mesma paleta da web
export const theme = {
  bg: "#0D0D1A",
  bgElevated: "#16213E",
  border: "#2D2D44",
  text: "#E8E8F0",
  textMuted: "rgba(255,255,255,0.5)",
  textDim: "rgba(255,255,255,0.3)",
  orange: "#FF6B35",
  purple: "#a78bfa",
  green: "#4CAF82",
  blue: "#60a5fa",
  red: "#ff4444",
  yellow: "#fbbf24",
  fontDisplay: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  fontMono: '"JetBrains Mono", "SF Mono", monospace',
} as const;

// Music moods — tracks bundled em /public/music/
// BPM é usado para sync de cortes. Todos CC0 do Pixabay Music.
// Placeholders até adicionarmos MP3s reais.
export type MoodDef = {
  id: "eletronica" | "acao" | "heroico" | "chill";
  label: string;
  icon: string;
  file: string; // relativo a staticFile()
  bpm: number;
  color: string;
};

export const MOODS: Record<string, MoodDef> = {
  eletronica: {
    id: "eletronica",
    label: "Eletrônica",
    icon: "🎧",
    file: "music/eletronica.mp3",
    bpm: 140,
    color: "#a78bfa",
  },
  acao: {
    id: "acao",
    label: "Ação",
    icon: "⚡",
    file: "music/acao.mp3",
    bpm: 128,
    color: "#FF6B35",
  },
  heroico: {
    id: "heroico",
    label: "Heroico",
    icon: "🦸",
    file: "music/heroico.mp3",
    bpm: 120,
    color: "#fbbf24",
  },
  chill: {
    id: "chill",
    label: "Chill",
    icon: "😎",
    file: "music/chill.mp3",
    bpm: 90,
    color: "#4CAF82",
  },
};

// Frames por segundo do projeto — 30fps para render rápido no Railway
export const FPS = 30;

// Tracks MP3 presentes em public/music/? Trocar para true depois de adicionar
// os arquivos (ver public/music/README.md). Default false para o Studio abrir
// sem crash quando o repo ainda não tem os MP3s.
export const MUSIC_ENABLED = false;

// Helper: segundos → frames
export const s2f = (sec: number) => Math.round(sec * FPS);
