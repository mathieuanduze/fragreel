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

// Dimensões por orientação. Vertical = TikTok/Reels/Shorts; Horizontal = YouTube/Twitch.
// Helper único pra evitar 1080/1920 mágicos espalhados pelo código.
export const DIMENSIONS = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
} as const;

export type Orientation = keyof typeof DIMENSIONS;

export const getDimensions = (orientation: Orientation = "vertical") =>
  DIMENSIONS[orientation];

// Tracks MP3 presentes em public/music/? Ativado em 2026-04-22 quando as 4
// trilhas Pixabay CC0 foram adicionadas (eletronica/acao/heroico/chill.mp3).
// Ver Obsidian nota 09 pro guia de moods.
// v0.3.1 (Round 4c Fase 1.10): MUSIC_ENABLED é override GLOBAL (debug).
// Em produção, controle vem de ReelProps.musicEnabled (default true,
// user pode desligar via UI toggle). Mantido aqui pra dev preview no
// Studio (Studio não passa props customizados, usa MOCK_REEL_PROPS).
export const MUSIC_ENABLED = true;

// Helper: segundos → frames
export const s2f = (sec: number) => Math.round(sec * FPS);

// Duração de highlight em segundos, derivada de highlight.end - highlight.start.
// Aplicamos um clamp pra não ter cena de 1s (vira flash imperceptível) nem
// de 30s+ (cansa o viewer no formato vertical). Bounds diferentes por formato.
//
// v0.3.1 Round 4c Fase 1.10 (Mathieu spec confirmada): max bumped 7 → 35.
// REASON: spec produto é "real-time SEMPRE — sem time-lapse/fast cuts".
// Antes, source de 32s (com cluster_round_kills_v2 PAD 7+5 + bomb extension)
// + scene clamp 7s = playbackRate 4.5x → gunfights ilegíveis ("acelerado").
// Agora scene = source duration garante playbackRate ≈ 1.0 (real-time).
// Trade: MP4 final fica ~80s pra 3 highlights vs 25s anterior — aceitável
// pra Reels/TikTok (cap 90s) e legibilidade infinitamente melhor.
// Cluster v0.3.0-beta-2 já garante max ~30s/highlight (PAD + clamps).
export const REEL_HIGHLIGHT_BOUNDS = { min: 3, max: 35 } as const;
export const RECAP_HIGHLIGHT_BOUNDS = { min: 4, max: 45 } as const;

export function clampHighlightSec(
  rawSec: number,
  bounds: { min: number; max: number }
): number {
  if (!isFinite(rawSec) || rawSec <= 0) return bounds.min;
  return Math.max(bounds.min, Math.min(bounds.max, rawSec));
}

// Easing canônico — perfis reutilizáveis pra spring().
// Em vez de espalhar { damping: 14, mass: 0.6 } pelo código (cada cena com
// seu próprio "feel"), centralizamos 3 perfis que cobrem 95% dos casos.
// Vem do guia de best practices: punch (impacto), pop (entrada padrão),
// glide (transição suave longa).
export const SPRING = {
  // Entrada agressiva — rank badges, flash, trigger de impacto
  punch: { damping: 10, mass: 0.5, stiffness: 180 },
  // Entrada padrão — labels, kills, tudo que precisa "aparecer"
  pop: { damping: 14, mass: 0.6, stiffness: 130 },
  // Transição suave longa — fade entre cenas, drift, parallax
  glide: { damping: 22, mass: 1.2, stiffness: 90 },
} as const;

// Tempo da i-ésima kill DENTRO da cena de highlight (0..sceneDurationSec).
// Se o parser nos deu kill.time absoluto, reaproveitamos relativo ao start.
// Caso contrário, distribuímos uniformemente entre 0.5s e (sceneDuration - 0.5s).
// O 0.5s de margem evita kill colando na borda da cena (parece bug visual).
export const KILL_FEED_EDGE_PAD_SEC = 0.5;
export function killTimeInSceneSec(
  kill: { time?: number },
  killIndex: number,
  totalKills: number,
  highlightStart: number,
  sceneDurationSec: number
): number {
  if (typeof kill.time === "number" && isFinite(kill.time)) {
    const rel = kill.time - highlightStart;
    return Math.max(0, Math.min(sceneDurationSec, rel));
  }
  // Fallback uniforme.
  if (totalKills <= 0) return 0;
  const usable = Math.max(0, sceneDurationSec - 2 * KILL_FEED_EDGE_PAD_SEC);
  if (totalKills === 1) return KILL_FEED_EDGE_PAD_SEC + usable / 2;
  const step = usable / (totalKills - 1);
  return KILL_FEED_EDGE_PAD_SEC + step * killIndex;
}
