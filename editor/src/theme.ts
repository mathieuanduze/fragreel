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
type _AliveEventInput = { time: number; alive_ct: number; alive_t: number };
type _HighlightInput = {
  start: number;
  end: number;
  kills: _KillTimeInput[];
  bomb_action_timestamp?: number;
  bomb_action?: string;
  alive_timeline?: _AliveEventInput[];
  gameplayStartSec?: number;
};

// Round 4c Fase 1.27 — resolveAliveAt: encontra alive count NO MOMENTO X
// do gameplay (sceneTimeSec mapped to demo time via highlight.start +
// effectiveSkipSec offset). Navega alive_timeline (TODAS deaths, não só
// user kills) e retorna estado APÓS o último event que aconteceu até
// `demoTimeSec`. Antes da primeira morte: 5v5.
//
// Mathieu reportou pós-Fase 1.23: counter "pula 5v5 → 1v1 do nada" — root
// cause: Fase 1.23 só atualizava em user kills, ignorava deaths intermédios.
// Agora com timeline completa, counter atualiza a CADA morte (qualquer team).
export const resolveAliveAt = (
  highlight: _HighlightInput,
  demoTimeSec: number,
): { alive_ct: number; alive_t: number; hasTimeline: boolean } => {
  const tl = highlight.alive_timeline;
  if (!tl || tl.length === 0) {
    return { alive_ct: 5, alive_t: 5, hasTimeline: false };
  }
  // Find latest event with event.time <= demoTimeSec
  let latest: _AliveEventInput | null = null;
  for (const ev of tl) {
    if (ev.time <= demoTimeSec) {
      if (!latest || ev.time > latest.time) latest = ev;
    }
  }
  if (latest === null) {
    // Antes da primeira morte do round = 5v5
    return { alive_ct: 5, alive_t: 5, hasTimeline: true };
  }
  return { alive_ct: latest.alive_ct, alive_t: latest.alive_t, hasTimeline: true };
};

// effectiveSceneEndSec — calcula em que segundo do source a cena DEVE
// terminar. EVENT-AWARE: usa max de kill times E bomb_action_timestamp
// pra cobrir highlights cuja closing event é plant/defuse (não kill).
// Round 4c Fase 1.25 (Mathieu múltiplas vezes "plant não aparece"): Fase
// 1.22 só considerava kills, então cena terminava antes do plant que
// frequentemente ocorre 2-5s após última kill. Agora inclui bomb event
// como evento closing legítimo. Capped pelo TAIL pra não estender além
// do .mov disponível.
//
// Compartilhado entre HighlightsReel.highlightDurationSec (define
// scene duration na composition) e HighlightScene.availableVideoSec
// (define playback rate). DEVEM bater, senão freeze edge.
// Round 4c Fase 1.28 — gameplay reference start (mov first frame demo time).
// Compartilhado entre effectiveSceneEndSec, highlightDurationSec, killTime.
// gameplayStartSec é populado pelo hlae_runner quando cluster v2 é ativo.
// Senão, fallback pro highlight.start (round start, behavior antigo).
export const refStartSec = (highlight: _HighlightInput): number =>
  typeof highlight.gameplayStartSec === "number" && isFinite(highlight.gameplayStartSec)
    ? highlight.gameplayStartSec
    : highlight.start;

// Source duration ALINHADO com mov real (end - refStart) quando gameplay
// start disponível. Fallback pra round duration. Garante effective*Sec
// helpers todos usam o mesmo source durations.
//
// Round 4c Fase 1.30 (Mathieu plant FAIL escalation editor-side): quando
// bomb_action_timestamp existe E é APÓS highlight.end, o cluster v2 já
// estendeu capture (W4 plant_won post-round_end). Mov real é maior que
// (highlight.end - refStart). refSourceDurSec retorna o MAIOR de:
//   (a) highlight.end - refStart (round-based, behavior antigo)
//   (b) bomb_action_timestamp - refStart + REACTION (cobrir plant anim)
// Resultado: scene duration acomoda plant que ocorre 24s+ após round_end
// (R14 example: bomb_tick em round_end + 24s).
export const refSourceDurSec = (highlight: _HighlightInput): number => {
  const refStart = refStartSec(highlight);
  const roundBased = highlight.end - refStart;
  if (
    typeof highlight.bomb_action_timestamp === "number" &&
    isFinite(highlight.bomb_action_timestamp)
  ) {
    // Plant 3.2s + reaction. Defuse 10s + reaction. Usar 6s extra
    // cobre ambos com folga (effectiveTailSkipSec corta o que sobrar).
    // Round 4c Fase 1.30 — 8s extra cobre plant 3.2s + reaction +
    // tail buffer pro effectiveTailSkipSec não cortar plant frames.
    // Calibrated em R14 case (PC test 27/04 night): plant tick em
    // round_end + 24s, scene precisava 8s margin pra mostrar full
    // animation + bomb planted notification.
    const bombBased =
      highlight.bomb_action_timestamp - refStart + REACTION_PAD_SEC + 8.0;
    return Math.max(0.1, roundBased, bombBased);
  }
  return Math.max(0.1, roundBased);
};

export const effectiveSceneEndSec = (highlight: _HighlightInput): number => {
  const refStart = refStartSec(highlight);
  const sourceDur = refSourceDurSec(highlight);
  const tailFallbackEnd = sourceDur - effectiveTailSkipSec(sourceDur);

  // Eventos closing candidatos: kills + bomb event (plant/defuse). Pick max.
  const eventTimes: number[] = [];
  for (const k of highlight.kills) {
    if (typeof k.time === "number" && isFinite(k.time)) {
      eventTimes.push(k.time - refStart);
    }
  }
  if (
    typeof highlight.bomb_action_timestamp === "number" &&
    isFinite(highlight.bomb_action_timestamp)
  ) {
    eventTimes.push(highlight.bomb_action_timestamp - refStart);
  }

  if (eventTimes.length === 0) {
    // Sem timing de eventos: fallback pro TAIL fixo (mesmo comportamento
    // das Fases 1.20/1.21).
    return tailFallbackEnd;
  }

  // Round 4c REACTION_PAD pra plant_won — evolução:
  //   Fase 1.25: REACTION + 3s = 4s pós bomb_action_timestamp
  //   Fase 1.30: bumped pra REACTION + 4s = 5s (cobertura conservadora)
  //   Fase 1.31 (Mathieu pós-Fase 1.30 PASS): "tela fica freezada no último
  //     frame por muito tempo, parece que o vídeo travou". 5s era demais —
  //     bomb_action_timestamp marca o tick de COMPLETION do plant. CS2
  //     native mostra "Bomba foi armada" red bar por ~1.5s, depois player
  //     fica idle (standing still). Sobravam ~2-3s de freeze visual.
  //     Reduzido pra 1.5s total fixed: cobre notification readable +
  //     pequeno safety. Cuts logo após bomb planted = no freeze residual.
  // Defuse mantém REACTION_PAD_SEC normal (closing event geralmente é
  // kill final ou reaction kill, não plant).
  const lastEventRelative = Math.max(...eventTimes);
  const isPlantClosing =
    highlight.bomb_action === "plant_won" &&
    typeof highlight.bomb_action_timestamp === "number" &&
    Math.abs((highlight.bomb_action_timestamp - refStart) - lastEventRelative) < 0.01;
  const reactionForThis = isPlantClosing ? 1.5 : REACTION_PAD_SEC;

  const dynamicSceneEnd = lastEventRelative + reactionForThis;
  // Cap pelo TAIL fallback (cluster pode ter PAD_POST < REACTION_PAD se
  // round_end_tick truncou). Plus floor pra evitar cena negativa em caso
  // patológico (event antes do highlight.start, não deveria acontecer).
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
// Round 4c Fase 1.30 (Mathieu plant escalation editor): max bumped 35 → 50s
// pra acomodar highlights cuja closing event é plant_won — cluster captura
// W3 kills (~15s) + W4 plant (~6s) + gap entre eles, com reaction.
// Round 4c Fase 1.31 (PC suggestion + Mathieu PASS plant): max ajustado
// 50 → 45s pra Shorts compat. PC reportou MP4 final 83.93s na Fase 1.30
// — Reels/TikTok cap 90s OK, mas YouTube Shorts cap 60s NÃO cabe. Com
// plant fix da Fase 1.31 (REACTION 5s→1.5s), scene #3 com plant fica
// ~33s vs 38s anterior. 3 highlights × ~25s média + intro 1.2s + outro
// 3s = ~80s — ainda over 60s pra worst case, mas perto. Reduzir BOUNDS
// 50→45 ajuda casos extremos sem prejudicar narrativa.
export const REEL_HIGHLIGHT_BOUNDS = { min: 3, max: 45 } as const;
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
// Round 4c Fase 1.28 BUG FIX REAL (Mathieu reportou pós-Fase 1.20: "kills
// aparecem todas atrasadas, não está acontecendo no momento do tick certo"):
// killTimeInSceneSec antes assumia gameplay começa em (highlight.start +
// frontSkip). Mas cluster v2 PAD_PRE = 7s do FIRST kill (não do round_start)
// — gameplay no .mov começa MUCH LATER que round_start. hlae_runner.py
// agora popula `gameplayStartSec` (= cluster_window[0].start_tick / tickrate).
// Editor passa esse field pra cá → offset CORRETO.
// Fallback pro Fase 1.20 behavior se gameplayStartSec ausente.
export const KILL_FEED_EDGE_PAD_SEC = 0.5;
export function killTimeInSceneSec(
  kill: { time?: number },
  killIndex: number,
  totalKills: number,
  highlightStart: number,
  sceneDurationSec: number,
  frontSkipSec: number = 0,
  gameplayStartSec?: number,
): number {
  if (typeof kill.time === "number" && isFinite(kill.time)) {
    // Round 4c Fase 1.28 — usa gameplayStartSec REAL (cluster window
    // start) quando disponível. Fallback pro highlight.start + frontSkip
    // (Fase 1.20 behavior, quando hlae_runner não populou o field).
    const movStartSec =
      typeof gameplayStartSec === "number" && isFinite(gameplayStartSec)
        ? gameplayStartSec + frontSkipSec
        : highlightStart + frontSkipSec;
    const rel = kill.time - movStartSec;
    return Math.max(0, Math.min(sceneDurationSec, rel));
  }
  // Fallback uniforme (sem timing info).
  if (totalKills <= 0) return 0;
  const usable = Math.max(0, sceneDurationSec - 2 * KILL_FEED_EDGE_PAD_SEC);
  if (totalKills === 1) return KILL_FEED_EDGE_PAD_SEC + usable / 2;
  const step = usable / (totalKills - 1);
  return KILL_FEED_EDGE_PAD_SEC + step * killIndex;
}
