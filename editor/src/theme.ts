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

// Round 4c Fase 1.19 (Mathieu re-cobrou pós-Fase 1.18 PASS): "ainda tá
// muito travadas as transições, principalmente DEPOIS do primeiro round".
// Análise dos frames PC: t=30s (fim #1 R8) player com faca, t=32s (início
// #2 R7) ainda player com faca andando na rua — ~5s de buy phase + walk
// pré-engagement por cluster. SKIP 2.0s da Fase 1.12 cobria só os
// primeiros 2s do cluster PAD_PRE 7s, deixando 5s "vazios" no início de
// cada highlight.
//
// SKIP 2.0 → 4.0s deixa só 3s pré-kill (peek + posicionamento + tiro).
// Com rate fix da Fase 1.18b (`availableVideoSec = sourceDur - SKIP` no
// numerator), scene clamp ajusta automaticamente sem freeze.
//
// Edge case (Fase 1.19): pra clusters MUITO curtos (single kill < 8s
// total source), SKIP=4 deixaria <4s playable. HighlightsReel.tsx
// aplica `effectiveSkip = min(SKIP, sourceDur * 0.5)` defensive.
export const HIGHLIGHT_VIDEO_SKIP_SEC = 4.0;

// effectiveSkipSec — clampa SKIP a 50% do source pra não roubar metade
// de clusters muito curtos (single kill < 8s). Caso comum (cluster
// 20-30s, SKIP 4): retorna 4. Edge (cluster 6s, SKIP 4): retorna 3.
// Vive em theme.ts (não em HighlightsReel) pra evitar circular import
// com HighlightScene.
export const effectiveSkipSec = (sourceDurSec: number): number =>
  Math.min(HIGHLIGHT_VIDEO_SKIP_SEC, Math.max(0, sourceDurSec * 0.5));

// Round 4c Fase 1.20 — pula últimos N segundos de cada .mov de gameplay.
// Cluster v0.3.0-beta-2 usa V2_PAD_POST_S = 5.0 (captura pós-último-event
// pra body drop, reaction, reload). Mas pra defuse rounds isso vira
// "player parado com knife olhando o nada" 3-5s = perceivable como
// FREEZE pelo viewer (Mathieu reportou: "vídeo pausa, fica travado,
// parece que bugou. Mas aí volta pro próximo round").
//
// Análise visual de frames PC (extraídos t=29.8/30.0/30.2/.../31.4s)
// confirmou GAMEPLAY pixel-frozen por 1.2s no fim do highlight #1
// (defuse) — viewmodel sem breathing animation = não é "player parado",
// é footage real de "post-defuse standing still" indistinguível de bug.
//
// TAIL_SKIP = 3.0s deixa 2s pós-event (suficiente pra ver body drop /
// defuse complete) sem o "standing still" longo. Cluster mantém
// PAD_POST 5s na CAPTURA (HLAE precisa pra mirv_streams record stop
// graceful), mas no PLAYBACK do reel cortamos 3s do fim.
//
// Reel inteiro fica ~9s mais curto pra 3 highlights — aceitável trade
// vs sumir freeze que parece bug.
// Round 4c Fase 1.21 (Mathieu pós-Fase 1.20 PASS): "transições ainda
// estão demorando muito entre plays, não precisa de um pause tão longo
// entre cada cena". TAIL 3.0 → 4.5s — corta mais 1.5s do tail (era
// "defuse + 2s reaction"; agora "defuse + 0.5s reaction"). Plus
// fadeOut 6→3 frames (HighlightScene) acelera o cut em si.
export const HIGHLIGHT_VIDEO_TAIL_SKIP_SEC = 4.5;

// effectiveTailSkipSec — mesma lógica de clamp pra clusters curtos.
// Não pode roubar mais que 50% do que sobrou pós-SKIP_FRONT senão
// some a action. Caso comum (cluster 25s, SKIP 4, TAIL 4.5): cena 16.5s.
// Edge (cluster 8s, SKIP 4): pós-front sobra 4s, TAIL clampa em 2s
// (50% do remaining), cena = 2s — clamp REEL_BOUNDS sobe pra min 3s.
export const effectiveTailSkipSec = (sourceDurSec: number): number => {
  const remainingAfterFront = Math.max(0, sourceDurSec - effectiveSkipSec(sourceDurSec));
  return Math.min(HIGHLIGHT_VIDEO_TAIL_SKIP_SEC, remainingAfterFront * 0.5);
};

// Round 4c Fase 1.22 — REACTION_PAD: tempo após a última kill antes da
// cena cortar. Mathieu reportou pós-Fase 1.21: "vídeo fica pausado por
// 1 segundo antes da transição, parece que trava". Diagnóstico: TAIL_SKIP
// fixo cortava do FIM do source, não do fim da AÇÃO. Quando última kill
// acontecia cedo no cluster (e PAD_POST + bomb extension davam ainda mais
// tail), sobrava 1-3s pós-action standing still antes da TAIL cortar.
// Fix: scene termina dinamicamente em `last_kill_time + REACTION_PAD_SEC`
// quando temos kill timing, capped pelo TAIL fallback (não estender além
// do que cluster captou). 1s é suficiente pra ver body drop / kill react
// sem dead time.
export const REACTION_PAD_SEC = 1.0;

// Tipo duck-typed pra evitar circular import com types.ts (que importa
// Orientation deste arquivo).
type _KillTimeInput = { time?: number };
type _HighlightInput = { start: number; end: number; kills: _KillTimeInput[] };

// effectiveSceneEndSec — calcula em que segundo do source a cena DEVE
// terminar. Kill-aware quando possível (last_kill + REACTION_PAD), senão
// fallback pro TAIL fixo. Capped pelo TAIL pra não estender além do
// content disponível no .mov.
//
// Compartilhado entre HighlightsReel.highlightDurationSec (define
// scene duration na composition) e HighlightScene.availableVideoSec
// (define playback rate). DEVEM bater, senão freeze edge.
export const effectiveSceneEndSec = (highlight: _HighlightInput): number => {
  const sourceDur = Math.max(0.1, highlight.end - highlight.start);
  const tailFallbackEnd = sourceDur - effectiveTailSkipSec(sourceDur);

  const killTimes = highlight.kills
    .map((k) => k.time)
    .filter((t): t is number => typeof t === "number" && isFinite(t));

  if (killTimes.length === 0) {
    // Sem kill timing: fallback pro TAIL fixo (mesmo comportamento das
    // Fases 1.20/1.21).
    return tailFallbackEnd;
  }

  const lastKillRelative = Math.max(...killTimes) - highlight.start;
  const dynamicSceneEnd = lastKillRelative + REACTION_PAD_SEC;
  // Cap pelo TAIL fallback (cluster pode ter PAD_POST < REACTION_PAD se
  // round_end_tick truncou). Plus floor pra evitar cena negativa em caso
  // patológico (kill antes do highlight.start, não deveria acontecer).
  return Math.max(0.5, Math.min(dynamicSceneEnd, tailFallbackEnd));
};

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
//
// Round 4c Fase 1.20 BUG FIX (Mathieu reportou "kills não aparecem em cima
// à direita junto com o momento que elas acontecem"): a função antes não
// considerava o SKIP/TAIL offset do gameplay. Com OffthreadVideo startFrom
// pulando frontSkip segundos, kill em source_t=10s aparece visualmente em
// scene_t=(10 - frontSkip). Antes calculava `kill.time - highlightStart`
// dando scene_t=10s — killfeed aparecia ~4s ATRASADO do momento real.
// Agora aceita frontSkipSec opcional pra alinhar killfeed com gameplay.
export const KILL_FEED_EDGE_PAD_SEC = 0.5;
export function killTimeInSceneSec(
  kill: { time?: number },
  killIndex: number,
  totalKills: number,
  highlightStart: number,
  sceneDurationSec: number,
  frontSkipSec: number = 0
): number {
  if (typeof kill.time === "number" && isFinite(kill.time)) {
    // Posição absoluta no source: kill.time - highlightStart
    // Posição visível na CENA (com SKIP aplicado): subtrair frontSkipSec
    const rel = kill.time - highlightStart - frontSkipSec;
    return Math.max(0, Math.min(sceneDurationSec, rel));
  }
  // Fallback uniforme.
  if (totalKills <= 0) return 0;
  const usable = Math.max(0, sceneDurationSec - 2 * KILL_FEED_EDGE_PAD_SEC);
  if (totalKills === 1) return KILL_FEED_EDGE_PAD_SEC + usable / 2;
  const step = usable / (totalKills - 1);
  return KILL_FEED_EDGE_PAD_SEC + step * killIndex;
}
