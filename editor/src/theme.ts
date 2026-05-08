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
// Sprint #6.4 (05/05): refatorado de `file: string` (1 track) → `tracks:
// string[]` (multi-variant per mood). User picks variant em ReelProps.
// trackVariantIndex (default 0). Backward-compat: `file` deprecated mas
// ainda lido como fallback (highlights/dev preview que setam `file` direto).
//
// Pra ADICIONAR tracks novas (sem código novo): drop MP3 em
// editor/public/music/<mood>-2.mp3 (ou qualquer nome) → adicionar string
// em MOODS[mood].tracks. Estrutura permanente, escalável.
export type MoodDef = {
  id: "eletronica" | "acao" | "heroico" | "chill";
  label: string;
  icon: string;
  tracks: { file: string; label: string }[];   // Sprint #6.4 — multi-variant
  /** @deprecated use tracks[index].file. Read-only fallback pra dev preview. */
  file?: string;
  bpm: number;
  color: string;
};

export const MOODS: Record<string, MoodDef> = {
  eletronica: {
    id: "eletronica",
    label: "Eletrônica",
    icon: "🎧",
    // TODO Mathieu: dropar mais MP3s aqui (sources Pixabay/CC0). Ex:
    //   { file: "music/eletronica-driving.mp3", label: "Driving" },
    //   { file: "music/eletronica-synthwave.mp3", label: "Synthwave" },
    tracks: [
      { file: "music/eletronica.mp3", label: "Original" },
    ],
    file: "music/eletronica.mp3",
    bpm: 140,
    color: "#a78bfa",
  },
  acao: {
    id: "acao",
    label: "Ação",
    icon: "⚡",
    tracks: [
      { file: "music/acao.mp3", label: "Original" },
    ],
    file: "music/acao.mp3",
    bpm: 128,
    color: "#FF6B35",
  },
  heroico: {
    id: "heroico",
    label: "Heroico",
    icon: "🦸",
    tracks: [
      { file: "music/heroico.mp3", label: "Original" },
    ],
    file: "music/heroico.mp3",
    bpm: 120,
    color: "#fbbf24",
  },
  chill: {
    id: "chill",
    label: "Chill",
    icon: "😎",
    tracks: [
      { file: "music/chill.mp3", label: "Original" },
    ],
    file: "music/chill.mp3",
    bpm: 90,
    color: "#4CAF82",
  },
};

// Sprint #6.4 — resolve track file from mood + variant index.
// Default variant 0 (primary). Out-of-range index → falls back to 0.
export function resolveMoodTrack(moodId: string, variantIndex = 0): string {
  const mood = MOODS[moodId];
  if (!mood) return "music/acao.mp3"; // safe fallback
  const tracks = mood.tracks;
  if (!tracks || tracks.length === 0) return mood.file ?? "music/acao.mp3";
  const idx = Math.max(0, Math.min(variantIndex, tracks.length - 1));
  return tracks[idx].file;
}

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

// Round 4c REACTION_PAD evolução por TIPO de event closing:
//   Fase 1.22 — generic 1.0s
//   Fase 1.31 — plant_won 1.5s (cobrir CS2 native "Bomba foi armada"
//     red bar). Default kill mantido 1.0s.
//   Fase 1.34 — Mathieu reportou 3 issues pós-Fase 1.33 PASS plant
//     mas content cortado:
//     #1 R8 defuse: "defuse animation começa mas NÃO termina"
//     #2 R7: "segunda kill mal aparece — corta no momento exato do
//            impacto, sem padding pós-kill"
//     #3 R14 plant: "NÃO mostra plant completion + 'Bomba foi armada'"
//   Bumpado por categoria pra cobrir notification readable + body fall:
//     Normal kill: 1.0 → 2.0s (body fall + viewmodel idle + breathing)
//     plant_won: 1.5 → 3.0s (CS2 red bar "Bomba foi armada" 2s + buffer)
//     defuse: NEW 4.0s (CS2 red→green "Bomba defusada" 3s + buffer)
//   Source-side complementar: V2_PLANT_POST_BUFFER_S 2→5s + V2_DEFUSE_
//   POST_BUFFER_S 2.5→5s (capture mais frames pós-action).
export const REACTION_PAD_SEC = 2.0;
// Round 4c Fase 1.35 — REACTION_PAD_PLANT_SEC bumped 3.0 → 4.5s.
// PC catched pós-Fase 1.34: plant action + bomb on ground visíveis MAS
// "Bomba foi armada" red bar notification ainda cortada. CS2 native
// popup aparece ~1.5s pós-plant_complete e dura ~2s readable. 3s
// REACTION cortava no meio. 4.5s = 1.5s popup delay + 2s readable +
// 1s breathing buffer. Capture-side complementar: V2_PLANT_POST_BUFFER
// bumped 5→7s pra mov ter frames suficientes.
export const REACTION_PAD_PLANT_SEC = 4.5;
// Round 4d Sprint v5.7 (08/05/2026 Mathieu): "meu defuse não ficou até o
// final". Bumped 4.0 → 6.0s. Defuse animation completa em ~10s (sem kit)
// ou ~5s (com kit) — bomb_action_timestamp marca COMPLETION mas se cluster
// captura/render rate distort timing, 4s pad pode não cobrir + buffer pra
// "Bomba defusada" notif (~3s). 6s = animation tail + notif + safety.
export const REACTION_PAD_DEFUSE_SEC = 6.0;

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
  actualMovDurationSec?: number;
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
  // Round 4c Fase 1.33 — quando temos `actualMovDurationSec` (probed
  // pelo client pós-concat ffmpeg), USA esse valor como source truth.
  // Pra clusters multi-window (R14 W3 kills + W4 plant separados por
  // gap > MERGE_GAP), source-time estimate INCLUI o gap (que não foi
  // capturado), causando HOLD LAST FRAME no playback. actualMov reflete
  // bytes reais do .mov concatenado. ALWAYS preferred quando disponível.
  if (
    typeof highlight.actualMovDurationSec === "number" &&
    isFinite(highlight.actualMovDurationSec) &&
    highlight.actualMovDurationSec > 0
  ) {
    return highlight.actualMovDurationSec;
  }

  // Fallback (Fase 1.30 — bomb_action_timestamp pode estar APÓS
  // highlight.end pra plants pós-round_end).
  const refStart = refStartSec(highlight);
  const roundBased = highlight.end - refStart;
  if (
    typeof highlight.bomb_action_timestamp === "number" &&
    isFinite(highlight.bomb_action_timestamp)
  ) {
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
  // Round 4c Fase 1.34 — REACTION_PAD por TIPO de event closing.
  // Mathieu reportou pós-Fase 1.33 que defuse + plant cortavam SEM
  // cobrir notification "Bomba defusada" / "Bomba foi armada". Plus
  // normal kills tinham 0 padding pós-impacto (body fall mal visível).
  // Detectar bomb_action é o closing event (last event time matches
  // bomb_action_timestamp) e usar REACTION específico por tipo.
  const lastEventRelative = Math.max(...eventTimes);
  const bombIsClosing =
    typeof highlight.bomb_action_timestamp === "number" &&
    Math.abs((highlight.bomb_action_timestamp - refStart) - lastEventRelative) < 0.01;
  let reactionForThis = REACTION_PAD_SEC; // 2.0s default (kill aftermath)
  if (bombIsClosing) {
    if (highlight.bomb_action === "plant_won") {
      reactionForThis = REACTION_PAD_PLANT_SEC; // 3.0s — "Bomba foi armada" notif
    } else if (highlight.bomb_action === "defuse") {
      reactionForThis = REACTION_PAD_DEFUSE_SEC; // 4.0s — "Bomba defusada" notif
    }
  }

  const dynamicSceneEnd = lastEventRelative + reactionForThis;

  // Round 4d 3.5 BUG FIX (Mathieu 29/04, primeiro reel próprio: "Cena 1
  // muito longa — kills isoladas + corte antes do defuse"): quando closing
  // event é bomb (defuse/plant_won) E cluster v2 já adicionou bomb sub-
  // window com V2_DEFUSE_POST_BUFFER_S=5s ou V2_PLANT_POST_BUFFER_S=7s, o
  // mov real tem buffer pós-action pra mostrar "Bomba defusada/armada"
  // notification. tailFallbackEnd = sourceDur - 4.5s cortava 4.5s desse
  // buffer = notification mal-aparecia (apenas 0.5s visível em casos
  // borderline).
  //
  // Round 4d 3.5.1 BUG FIX (Mathieu 05/05, novo reel): "última kill das
  // cenas cortam muito rápido novamente". Round 4d 3.5 fix original só
  // tratou bomb-closing. Kill-closing ainda usava tailFallback (sourceDur-
  // 4.5s) como upperCap, cortando reaction de kills tardias:
  //   mov 18s, lastKill aos 14s, reaction 2s → dynamicSceneEnd = 16s
  //   tailFallback = 13.5s → scene corta em 13.5, kill aos 14 NUNCA aparece
  //
  // Root cause arquitetural: tailFallback só faz sentido como "no events"
  // fallback (cortar standing-still trailing). Quando temos events,
  // dynamicSceneEnd = lastEvent + reaction É o cap natural. Aplicar
  // tailFallback adicional cortava events legítimos.
  //
  // Fix: upperCap = sourceDur SEMPRE quando há events. dynamicSceneEnd
  // já é bounded pelo lastEvent + reaction apropriada (kill 2s, plant 3s,
  // defuse 4s) — não precisa cap extra. sourceDur garante não passar mov
  // físico (anti hold-last-frame).
  // Aplica pra kill-closing E bomb-closing (subsumes Round 4d 3.5).
  const upperCap = sourceDur;

  // Cap pelo upper bound apropriado. Plus floor pra evitar cena negativa
  // em caso patológico (event antes do highlight.start).
  return Math.max(0.5, Math.min(dynamicSceneEnd, upperCap));
};

/**
 * 05/05 — Round 4d 3.5 V3 (Mathieu reportou 3ª vez): plant/defuse cortando
 * em highlights longos (multi-kill + bomb action).
 *
 * Root cause final: REEL_HIGHLIGHT_BOUNDS.max=60s clampava o END da scene.
 * Highlights com mov 70-75s (multi-window cluster + bomb buffer) ficavam
 * com sceneEnd=70s, rawSec=66s, clamped=60s → últimos 6s (que CONTÊM o
 * plant/defuse) nunca renderizavam.
 *
 * Fix: smart skip. Quando scene natural > max, em vez de cortar END
 * (events), CORTA O FRONT (walking pre-engagement). Preserva os events
 * (que são o motivo do highlight existir) sacrificando o pre-action.
 *
 * Used by:
 *   - HighlightsReel.highlightDurationSec (define scene size)
 *   - HighlightScene.sceneSkipSec (define startFrom do <OffthreadVideo>)
 *
 * Returns: skip seconds (front trimmed). Sempre >= effectiveSkipSec(sourceDur).
 */
export const effectiveSkipSecSmart = (highlight: _HighlightInput): number => {
  const sourceDur = refSourceDurSec(highlight);
  const naturalSkip = effectiveSkipSec(sourceDur);
  const sceneEnd = effectiveSceneEndSec(highlight);
  const naturalDur = sceneEnd - naturalSkip;
  if (naturalDur <= REEL_HIGHLIGHT_BOUNDS.max) {
    return naturalSkip;
  }
  // Scene too long → bump skip pra fit max, preservando END (events).
  const overshoot = naturalDur - REEL_HIGHLIGHT_BOUNDS.max;
  // Não pode skip > sceneEnd - min_dur (se não scene fica < min)
  const maxSkip = Math.max(0, sceneEnd - REEL_HIGHLIGHT_BOUNDS.min);
  return Math.min(naturalSkip + overshoot, maxSkip);
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
//
// Round 4d 3.1 (Mathieu 29/04, primeiro reel próprio): "Velocidade muito
// rápida — parece 2x em alguns momentos". Root cause: cluster v2 captura
// big highlights (kills + plant + defuse, R14 example: 24s gap entre W3
// e W4) gerando source ~50-90s. Scene clamp em 45s = playbackRate
// (availableVideo / scene) > 1.0 em clusters grandes. Pra rate=2.0 →
// source=90s sob scene=45s. Mathieu spec original (Fase 1.10): "real-time
// SEMPRE — sem time-lapse/fast cuts". Compromise: bump max 45→60s.
//   - Reel worst case 3×60s + intro 1.2 + outro 3 = 184s
//   - Reels/TikTok cap 90s: NÃO fits no worst case (mas média 3×30s = 93s)
//   - YouTube Shorts cap 60s: já não fits desde Fase 1.30
// Decisão: priorizar real-time playback (não acelerar) sobre Shorts compat.
// Reels/TikTok são audience principal pra CS2 reels (Shorts é nicho).
// Plus: killTimeInSceneSec agora compensa rate (3.3 fix), então mesmo
// quando rate>1 em casos extremos, killfeed alinha com video.
export const REEL_HIGHLIGHT_BOUNDS = { min: 3, max: 60 } as const;
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
//
// Round 4d 3.3 BUG FIX (Mathieu 29/04, primeiro reel próprio: "Killcount
// com delay (não sincroniza com kill)"): Fase 1.28 fixou OFFSET (start
// time) mas não RATE. Quando playbackRate > 1.0 (cluster v2 grande
// gerando source > scene_max, ver Round 4d 3.1), video plays acelerado
// MAS killTimeInSceneSec retornava tempo em DEMO time (segundos de source
// real), não SCENE time. Kill que acontece visualmente aos 2.5s no scene
// (rate=2x) tinha killfeed aparecendo aos 5s = 2.5s LATE.
// Fix: dividir rel por playbackRate pra mapear demo-time → scene-time.
//   sceneTime = (kill.time - movStart) / playbackRate
// Quando rate=1.0 (caso normal), behavior idêntico ao Fase 1.28.
// Quando rate=2.0 (cluster grande), kill aparece NO MOMENTO VISUAL.
export const KILL_FEED_EDGE_PAD_SEC = 0.5;
export function killTimeInSceneSec(
  kill: { time?: number },
  killIndex: number,
  totalKills: number,
  highlightStart: number,
  sceneDurationSec: number,
  frontSkipSec: number = 0,
  gameplayStartSec?: number,
  playbackRate: number = 1.0,
): number {
  if (typeof kill.time === "number" && isFinite(kill.time)) {
    // Round 4c Fase 1.28 — usa gameplayStartSec REAL (cluster window
    // start) quando disponível. Fallback pro highlight.start + frontSkip
    // (Fase 1.20 behavior, quando hlae_runner não populou o field).
    const movStartSec =
      typeof gameplayStartSec === "number" && isFinite(gameplayStartSec)
        ? gameplayStartSec + frontSkipSec
        : highlightStart + frontSkipSec;
    const relDemo = kill.time - movStartSec; // segundos no SOURCE/demo
    // Round 4d 3.3 — converte demo-time → scene-time dividindo por rate.
    // playbackRate defensive: clamp >0 pra não dividir por zero.
    const safeRate = playbackRate > 0.01 ? playbackRate : 1.0;
    const relScene = relDemo / safeRate;
    return Math.max(0, Math.min(sceneDurationSec, relScene));
  }
  // Fallback uniforme (sem timing info).
  if (totalKills <= 0) return 0;
  const usable = Math.max(0, sceneDurationSec - 2 * KILL_FEED_EDGE_PAD_SEC);
  if (totalKills === 1) return KILL_FEED_EDGE_PAD_SEC + usable / 2;
  const step = usable / (totalKills - 1);
  return KILL_FEED_EDGE_PAD_SEC + step * killIndex;
}
