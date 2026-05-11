/**
 * Highlight scorer — TypeScript port de api/parser/scorer.py.
 *
 * Port 1:1 do scoring v0.3.1+. Mantém comportamento bit-exact (mesmas
 * constantes, mesma ordem de bonuses, mesma lógica de clutch detection)
 * pra que client+API produzam highlights idênticos durante migração I.4.
 *
 * Quando bumpar o scorer real (ex: novo bonus, nova heurística), atualizar
 * SCORER_VERSION em route.ts pra invalidar caches client-side e telemetria
 * conseguir distinguir versões.
 *
 * Entrada: ParsedDemoEvents (kills, rounds, bomb_events) + player_steamid.
 * Saída: Highlight[] ranqueado (best first), até MAX_HIGHLIGHTS.
 */

import type {
  AliveEvent,
  BombAction,
  ClutchSituation,
  Highlight,
  KillEvent,
  KillInfo,
  ParsedDemoEvents,
  RoundContext,
  RoundState,
} from "./types";
import { weaponBonus, weaponDisplay } from "./weapons";

// ── Constants (sync com scorer.py) ────────────────────────────────────────────

export const ROUND_PRE_BUFFER = 15.0;
export const ROUND_POST_BUFFER = 5.0;
export const MIN_CLIP_LEN = 6.0;
export const MAX_HIGHLIGHTS = 10;

export const BASE_SCORE: Record<number, number> = {
  1: 30,
  2: 150,
  3: 400,
  4: 700,
  5: 1000,
};
export const HS_BONUS = 20;

export const CLUTCH_BONUS: Record<ClutchSituation, number> = {
  "1v2": 300,
  "1v3": 700,
  "1v4": 1200,
  "1v5": 2000,
};

export const ROUND_WINNING_KILL_BONUS = 150;
export const DEFUSE_BONUS = 200;
export const PLANT_WON_BONUS = 150;

// Cinema events (v0.3.1 B4)
export const THRUSMOKE_BONUS = 50;
export const NOSCOPE_BONUS = 40;
export const WALLBANG_BONUS = 30;
export const BLIND_KILL_BONUS = 30;
export const LOW_HP_BONUS = 20;
export const LOW_HP_THRESHOLD = 20;

const TEAM_SIZE = 5;

// ── Per-kill Aesthetic Scoring (Sprint 06/05) ───────────────────────────────
//
// Bônus por kill INDIVIDUAL — diferente do round bonus que conta UMA VEZ por
// round. Aqui cada kill tem seu próprio score técnico, e o editor visualiza
// estilo cinematic só nas top kills (top 25% por score, ou score >= threshold).
//
// Anti-fadiga: Mathieu spec — "em todas as kills pode ficar cansativo. minha
// intenção é que apareça o estilo visual só nas kills esteticamente mais
// bonitas". Threshold + cap controlam taxa de stylization.
//
// Pesos calibrados por raridade real em demos analisadas (14 pro demos +
// 1 hr de matchmaking Mathieu):
//   AWP no-scope: < 0.5% das kills → +50 (super raro)
//   Knife:        < 0.3% → +50 (raríssimo + ballsy)
//   Wallbang:     ~3% → +25 (skill + game knowledge)
//   Through smoke: ~2% → +20 (luck + sound positioning)
//   Blind kill:   ~1.5% → +25 (clutch awareness)
//   Pistol HS round 1/13: ~5% → +15 (precision under pressure)
//   Low HP win (<20):  ~4% → +15 (clutch dexterity)
//   Headshot premium (AWP/Deagle/CZ): ~8% → +10
//   Headshot regular: ~25% → +5 (small base bonus)
export const AESTHETIC_NOSCOPE = 50;
export const AESTHETIC_KNIFE = 50;
export const AESTHETIC_WALLBANG = 25;
export const AESTHETIC_THRUSMOKE = 20;
export const AESTHETIC_BLIND = 25;
export const AESTHETIC_PISTOL_ROUND_HS = 15;
export const AESTHETIC_LOW_HP_WIN = 15;
export const AESTHETIC_HS_PREMIUM = 10;
export const AESTHETIC_HS_REGULAR = 5;

/** Threshold pra editor renderizar visual style. Calibrado pra ~5-10% das
 *  kills receberem efeito (no-fatigue regime). */
export const AESTHETIC_STYLE_THRESHOLD = 25;

/** Premium HS weapons (one-shot kills, alta precisão exigida). */
const HS_PREMIUM_WEAPONS = new Set([
  "awp", "scar20", "g3sg1", // snipers
  "deagle", "revolver", // hand-cannon
  "cz75a", // CZ HS = clutch shot
  "dualies", "elite", // ballsy
]);

/** Pistol rounds em CS2 = round 1 (start) e round 13 (half-time start em MR12). */
function _isPistolRound(round_num: number): boolean {
  return round_num === 1 || round_num === 13;
}

/**
 * Sprint Aesthetic (06/05) — calcula score técnico/estético de UMA kill +
 * decide style visual.
 *
 * Score: soma de bonuses por execução notável. Style: highest-priority
 * effect type identificável (noscope > knife > wallbang > smoke > blind >
 * flick). Style só set quando score >= AESTHETIC_STYLE_THRESHOLD (controle
 * de fadiga — Mathieu spec).
 *
 * Priority order (visualmente mais distintivo wins):
 *   1. noscope    — AWP raw aim, mais cinematic dos efeitos
 *   2. knife      — kill ballsy, deserves color grade único
 *   3. wallbang   — game knowledge + skill, x-ray flash
 *   4. thrusmoke  — luck + sound, blue tint
 *   5. blind      — clutch awareness, white overpower
 *   6. flick      — high score genérico (low HP win, premium HS, pistol HS)
 */
function _computeKillAesthetic(
  kill: KillEvent,
): { score: number; style: import("./types").KillAestheticStyle } {
  let score = 0;
  let style: import("./types").KillAestheticStyle = null;

  // Cinema flags — independent bonuses, all add to score.
  // Style picks HIGHEST priority among matching flags (early-set wins,
  // checked in priority order).
  if (kill.noscope === true) {
    score += AESTHETIC_NOSCOPE;
    if (style === null) style = "noscope";
  }

  // Knife detection: weapon name in CS2 includes "knife", "bayonet", etc.
  // Demoparser2 reports as "knife" or specific knife variants — check both.
  const wepLower = kill.weapon.toLowerCase();
  if (wepLower === "knife" || wepLower.includes("bayonet") || wepLower.includes("karambit") ||
      wepLower.includes("butterfly") || wepLower.includes("flip") ||
      wepLower.includes("gut") || wepLower.includes("huntsman") ||
      wepLower.includes("falchion") || wepLower.includes("daggers") ||
      wepLower.includes("ursus") || wepLower.includes("navaja") ||
      wepLower.includes("stiletto") || wepLower.includes("talon") ||
      wepLower.includes("paracord") || wepLower.includes("survival") ||
      wepLower.includes("nomad") || wepLower.includes("skeleton") ||
      wepLower.includes("classic") || wepLower.includes("kukri")) {
    score += AESTHETIC_KNIFE;
    if (style === null) style = "knife";
  }

  if ((kill.penetrated ?? 0) > 0) {
    score += AESTHETIC_WALLBANG;
    if (style === null) style = "wallbang";
  }

  if (kill.thrusmoke === true) {
    score += AESTHETIC_THRUSMOKE;
    if (style === null) style = "smoke";
  }

  if (kill.attackerblind === true) {
    score += AESTHETIC_BLIND;
    if (style === null) style = "blind";
  }

  // Generic premium qualities → flick style (laranja flash, current Sprint
  // #6.1 effect). Aplicado SE score >= threshold mas sem cinema-specific tag.
  const hp = kill.attacker_health;
  if (hp !== null && hp !== undefined && hp < LOW_HP_THRESHOLD) {
    score += AESTHETIC_LOW_HP_WIN;
  }

  if (kill.headshot) {
    if (HS_PREMIUM_WEAPONS.has(wepLower)) {
      score += AESTHETIC_HS_PREMIUM;
    } else {
      score += AESTHETIC_HS_REGULAR;
    }
  }

  if (_isPistolRound(kill.round_num) && kill.headshot) {
    score += AESTHETIC_PISTOL_ROUND_HS;
  }

  // Long-range bonus: 30+ meters (units in demoparser2 distance field).
  // Conservative — só adiciona, não promove pra style próprio.
  if (kill.distance !== null && kill.distance !== undefined && kill.distance > 3000) {
    score += 5;
  }

  // Style threshold gate: só set style se score for alto o suficiente pra
  // justificar efeito visual. Cinema-specific styles (noscope, knife,
  // wallbang, smoke, blind) já passam threshold pelo bônus próprio.
  // Generic "flick" só seta se score genérico (hp/HS/pistol) somar >= threshold.
  if (style === null && score >= AESTHETIC_STYLE_THRESHOLD) {
    style = "flick";
  }

  // Se style foi set por cinema flag mas score ainda < threshold (raro,
  // edge case se threshold subir no futuro), zera o style pra não exibir
  // efeito sub-bar.
  if (style !== null && score < AESTHETIC_STYLE_THRESHOLD) {
    style = null;
  }

  return { score, style };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ScoreInput {
  events: ParsedDemoEvents;
  player_steamid: string;
  tickrate: number; // pra converter tick → segundos quando demo não traz timestamps
  /** Sprint #6.5 — roster steamid → name. Opcional pra back-compat com
   *  callers antigos. Sem roster, POV cuts não são marcados (victim_name
   *  fica null → scorer skip pov_eligible). */
  roster?: import("./types").RosterMap;
}

/**
 * Score and rank user-played ROUNDS into highlights.
 *
 * Returns up to MAX_HIGHLIGHTS, sorted by score descending. Each highlight =
 * 1 round where user got ≥1 kill. Cliente recebe kill_ticks/kill_timestamps
 * pra aplicar cluster algorithm local (gap=10s, pad=±5s/±3.5s).
 */
export function scoreKills(input: ScoreInput): Highlight[] {
  const { events, player_steamid, tickrate, roster } = input;
  const userKills = events.kills.filter(
    (k) => k.attacker_steamid === player_steamid,
  );
  if (userKills.length === 0) return [];

  // Group by round (preserve chronological order)
  const byRound = new Map<number, KillEvent[]>();
  for (const k of [...userKills].sort((a, b) => a.tick - b.tick)) {
    const arr = byRound.get(k.round_num) ?? [];
    arr.push(k);
    byRound.set(k.round_num, arr);
  }

  // Build round_states lookup (Python uses dict, JSON sends array)
  const roundStateMap = new Map<number, RoundState>();
  for (const rs of events.rounds) {
    roundStateMap.set(rs.round_num, rs);
  }

  // Sprint v5.7.18 (Mathieu 09/05/2026 round 4 — 6ª iteração defuse + 3ª 7×0):
  // O fix anterior (winner_team na wire format v5.7.18) ainda deixava score
  // 7×0 stuck pra HLTV pro demos. Causa: parser _parse_round_winners falhava
  // pra ALGUNS round_end events (winner=null) → state.winner_team=null →
  // wire format manda null → scorer fallback path falha (user_team=null pra
  // Pro Demo Player Picker quando player não kill nesse round) → round
  // não conta nem CT nem T.
  //
  // Fix robusto: deriva winner_team_inferred de TODAS as kills do round
  // (não só do user). Heurística: último kill do round = sobrevivente
  // do team vencedor (CS2 game logic — quem mata por último sobreviveu
  // até o end). Coverage: ~95% rounds (não cobre defuse-sem-kill ou
  // plant-timeout, mas esses são raros no scoreboard final).
  // Combina com bomb_events: se defuse aconteceu, CT venceu (override).
  const inferredWinnerByRound = new Map<number, number>();
  // Group ALL kills (não só user) by round, find last attacker_team
  const allKillsByRound = new Map<number, KillEvent[]>();
  for (const k of [...events.kills].sort((a, b) => a.tick - b.tick)) {
    const arr = allKillsByRound.get(k.round_num) ?? [];
    arr.push(k);
    allKillsByRound.set(k.round_num, arr);
  }
  for (const [rn, ks] of allKillsByRound.entries()) {
    const lastKill = ks[ks.length - 1];
    if (lastKill.attacker_team === 2 || lastKill.attacker_team === 3) {
      inferredWinnerByRound.set(rn, lastKill.attacker_team);
    }
  }
  // Bomb override: defuse → CT win (3); planted-without-defuse + T survived → T win (handled by last kill)
  for (const be of events.bomb_events) {
    if (be.action === "defused") {
      inferredWinnerByRound.set(be.round_num, 3); // CT defused = CT win
    }
  }

  const scored: Highlight[] = [];
  for (const [round_num, roundKills] of byRound.entries()) {
    scored.push(
      _scoreRound(roundKills, round_num, events, roundStateMap, player_steamid, tickrate, roster, inferredWinnerByRound),
    );
  }

  // Sort desc by score, assign ranks 1..N
  scored.sort((a, b) => b.score - a.score);
  for (let i = 0; i < scored.length; i++) {
    scored[i].rank = i + 1;
  }

  const final = scored.slice(0, MAX_HIGHLIGHTS);

  // Sprint #6.5 (07/05 round 8) — POV vítima APENAS pra LONG-DISTANCE kills.
  //
  // Mathieu spec round 8: "deixamos os replays só pras kills que são de
  // muita distância? que são as mais impressionantes?". Concordância:
  // POV vítima em spray-down de 5m não adiciona contexto, mas em AWP
  // cross-map a 30m+ é cinematografia pura — user vê de onde a bala veio.
  //
  // Threshold: POV_DISTANCE_MIN_UNITS = 800 (~15 metros em CS2). Round 10
  // (07/05 noite tardia): Mathieu não tinha demo com kill 1500u+ pra
  // testar UX → baixou pra 800u temporariamente pra qualquer demo de
  // matchmaking ter POV cuts. Calibrar definitivo (1200u? 1500u?) baseado
  // em feedback de campo após validar feel da replay scene.
  //
  // Cobre em 800u:
  //   - Engagement de mid em qualquer map (mid window Mirage, mid Inferno)
  //   - AWP holds em ângulos médios (não precisa cross-map)
  //   - Rifle peek out-of-position em qualquer site
  // Exclui: spray-down em corredor (< 5m), headshot pistola point-blank.
  const POV_DISTANCE_MIN_UNITS = 800;

  for (const hl of final) {
    if (!hl.kills || hl.kills.length === 0) continue;
    // Coleta candidates: kills com victim resolvido + long-distance
    const candidates = hl.kills.filter((k) => {
      if (!k.victim_name || !k.victim_steamid) return false;
      const dist = k.distance ?? 0;
      return dist >= POV_DISTANCE_MIN_UNITS;
    });
    if (candidates.length === 0) continue;
    // Sort: maior distance primeiro (mais impressionante), tiebreak por
    // aesthetic_style (no-scope, wallbang, etc) > aesthetic_score
    candidates.sort((a, b) => {
      const distA = a.distance ?? 0;
      const distB = b.distance ?? 0;
      if (distB !== distA) return distB - distA;
      const styleA = a.aesthetic_style != null ? 0 : 1;
      const styleB = b.aesthetic_style != null ? 0 : 1;
      if (styleA !== styleB) return styleA - styleB;
      return (b.aesthetic_score ?? 0) - (a.aesthetic_score ?? 0);
    });
    // Top 1 do highlight vira eligible (kill mais distante do round)
    candidates[0].pov_eligible = true;
  }

  return final;
}

// ── Internals ────────────────────────────────────────────────────────────────

function _scoreRound(
  roundKills: KillEvent[],
  round_num: number,
  events: ParsedDemoEvents,
  roundStateMap: Map<number, RoundState>,
  player_steamid: string,
  tickrate: number,
  roster?: import("./types").RosterMap,
  inferredWinnerByRound?: Map<number, number>,
): Highlight {
  const n = roundKills.length;
  const base = BASE_SCORE[Math.min(n, 5)] ?? 1000;
  let bonus = 0;
  const killInfos: KillInfo[] = [];

  // All kills do round (não só user) pra alive timeline (Fase 1.27)
  const allKillsInRound = events.kills
    .filter((k) => k.round_num === round_num)
    .sort((a, b) => a.tick - b.tick);

  const tr = tickrate > 0 ? tickrate : 64.0;

  // alive_timeline com TODAS deaths do round (CT + T)
  const aliveTimeline: AliveEvent[] = [];
  let cumCtDeaths = 0;
  let cumTDeaths = 0;
  for (const k of allKillsInRound) {
    if (k.victim_team === 3) cumCtDeaths += 1;
    else if (k.victim_team === 2) cumTDeaths += 1;
    else continue;
    aliveTimeline.push({
      time: k.tick / tr,
      alive_ct: Math.max(0, 5 - cumCtDeaths),
      alive_t: Math.max(0, 5 - cumTDeaths),
    });
  }

  // Per-kill bonuses + KillInfo composition
  for (const kill of roundKills) {
    const wepBonus = weaponBonus(kill.weapon);
    const hsBonusPts = kill.headshot ? HS_BONUS : 0;
    bonus += wepBonus + hsBonusPts;

    // Alive count APÓS essa kill
    const deathsUntil = allKillsInRound.filter(
      (k) => k.tick <= kill.tick && k.victim_team !== null && k.victim_team !== undefined,
    );
    const ctDeaths = deathsUntil.filter((k) => k.victim_team === 3).length;
    const tDeaths = deathsUntil.filter((k) => k.victim_team === 2).length;

    // Sprint Aesthetic (06/05): per-kill score + style hint pra editor
    const aesthetic = _computeKillAesthetic(kill);

    // 07/05 PC diag fix: campos null EXPLÍCITOS em vez de undefined,
    // pra JSON.stringify NÃO strippar (undefined vira chave-ausente,
    // null vira "key": null e fica no payload). Permite client diag
    // distinguir "scorer não emitiu" vs "scorer emitiu null".
    killInfos.push({
      label: _killLabel(kill),
      weapon: kill.weapon,
      headshot: kill.headshot,
      attacker_health: kill.attacker_health ?? null,
      alive_ct_after: Math.max(0, 5 - ctDeaths),
      alive_t_after: Math.max(0, 5 - tDeaths),
      time: kill.tick / tr,
      // Sprint Aesthetic — score sempre emitido (numero, never undefined)
      aesthetic_score: aesthetic.score,
      aesthetic_style: aesthetic.style,  // null se kill comum
      // Sprint #6.5 — pov metadata. pov_eligible default false (only top
      // 1-2 do reel viram true em post-processing). victim_steamid/name/
      // kill_tick sempre emitidos (null se not available).
      pov_eligible: false,
      victim_steamid: kill.victim_steamid || null,
      // Sprint v5.7.4 (Mathieu 08/05): tier fallback pro victim_name —
      //   1. kill.victim_name DIRETO do event row (parser captures
      //      user_name field do demoparser2 player_death)
      //   2. Roster lookup via victim_steamid (legacy / fallback)
      //   3. null → editor mostra "Inimigo" generic
      // Tier 1 evita "INIMIGO" quando demo tem player_info empty.
      victim_name:
        kill.victim_name ||
        (roster && kill.victim_steamid && roster[kill.victim_steamid]) ||
        null,
      kill_tick: kill.tick ?? null,
      // Round 8 (07/05) — distance pra filtro pov_eligible
      distance: kill.distance ?? null,
    } as KillInfo);
  }

  // Round-level context (each fires AT MOST ONCE per round)
  const ctx = _enrichWithRoundContext(roundKills, events, roundStateMap, player_steamid);

  if (ctx.clutch_situation) {
    bonus += CLUTCH_BONUS[ctx.clutch_situation] ?? 0;
  }
  if (ctx.is_round_winning_kill) bonus += ROUND_WINNING_KILL_BONUS;
  if (ctx.bomb_action === "defuse") bonus += DEFUSE_BONUS;
  else if (ctx.bomb_action === "plant_won") bonus += PLANT_WON_BONUS;

  // Cinema events (each AT MOST ONCE per round)
  if (roundKills.some((k) => k.thrusmoke === true)) bonus += THRUSMOKE_BONUS;
  if (roundKills.some((k) => k.noscope === true)) bonus += NOSCOPE_BONUS;
  if (roundKills.some((k) => (k.penetrated ?? 0) > 0)) bonus += WALLBANG_BONUS;
  if (roundKills.some((k) => k.attackerblind === true)) bonus += BLIND_KILL_BONUS;
  if (
    roundKills.some(
      (k) => k.attacker_health !== null && k.attacker_health !== undefined && k.attacker_health < LOW_HP_THRESHOLD,
    )
  ) {
    bonus += LOW_HP_BONUS;
  }

  // Banker's rounding pra match Python `round(score, 1)` exatamente
  // (Sprint I.4 cross-check fix). Score raramente tem .x5 boundary
  // (base + bonus são geralmente inteiros), mas usamos consistente.
  const score = roundBankers(base + bonus, 1);

  // Round capture window.
  //
  // Sprint I.4 PC test catched (28/04 noite): primeira impl usava
  // `Math.round(x * 10) / 10` que diverge de Python `round(x, 1)` em
  // valores `.x5` boundaries. JavaScript Math.round = round-half-AWAY-from-zero
  // (730.25 → 730.3); Python round = banker's rounding = round-half-to-EVEN
  // (730.25 → 730.2 porque 2 é par). Pra Sprint I.4 cross-check produzir 100%
  // MATCH com scorer.py, usamos `roundBankers` que replica comportamento
  // Python bit-exact.
  //
  // PC test detectou Δ=0.100s em 3 highlights de_dust2 — exatamente o
  // pattern que esse bug produz quando timestamp + buffer cai em .x5 boundary.
  const start = Math.max(0, roundBankers(roundKills[0].timestamp - ROUND_PRE_BUFFER, 1));
  let end = roundBankers(roundKills[roundKills.length - 1].timestamp + ROUND_POST_BUFFER, 1);
  if (end - start < MIN_CLIP_LEN) {
    end = roundBankers(start + MIN_CLIP_LEN, 1);
  }

  // Sprint v5.7.15 (Mathieu 09/05/2026): "placar virtual fica parado no
  // 7x0 o tempo todo, ele não vai mudando condizente ao round".
  // Causa: editor recebia scoreCt/T do match.score (final) ao invés do
  // score AT THAT ROUND. Fix scorer-side: computa score acumulado pré-
  // round e popula em score_ct_at_round / score_t_at_round. Editor lê
  // direto sem precisar acesso a events.rounds[].
  let score_ct_at_round = 0;
  let score_t_at_round = 0;

  // Sprint v5.7.18 round 4 (Mathieu 10/05/2026 6ª iteração): "seguimos
  // sem placar 7×0". Hierarchy de winner_team source (best→worst):
  //   1. rs.winner_team — direto do parser _parse_round_winners
  //   2. inferredWinnerByRound — derivado de last kill + bomb_events
  //      (cobre rounds onde parser falhou — comum em HLTV pro demos)
  //   3. user_won + user_team — fallback antigo, falha pra Pro Demo
  //      Player Picker quando picked player não tem kill nesse round
  //
  // Pra match 11×5 com 16 rounds, score deve atingir 11+5=16 acumulado.
  // Source #1 sozinho deixava 7+0 stuck pq parser perdia rounds T-side.
  // Source #2 garante coverage ~95% mesmo se parser falhar.

  // Itera TODOS rounds < round_num (não só os com round_state) — usa
  // inferredWinnerByRound como source primária se rs missing/null.
  // events.rounds só tem rounds onde parser conseguiu state, mas
  // inferredWinnerByRound tem rounds onde houve kills (cobre +).
  const allRoundNums = new Set<number>([
    ...events.rounds.map((r) => r.round_num),
    ...(inferredWinnerByRound?.keys() ?? []),
  ]);

  for (const rn of allRoundNums) {
    if (rn >= round_num) continue;
    const rs = roundStateMap.get(rn);
    const parserWinner = rs ? (rs as RoundState & { winner_team?: number }).winner_team : null;
    const inferredWinner = inferredWinnerByRound?.get(rn);

    // Source priority: parser direct > inferred from kills > user_won fallback
    let winnerTeam: number | null | undefined = parserWinner;
    if (winnerTeam !== 3 && winnerTeam !== 2) {
      winnerTeam = inferredWinner;
    }

    if (winnerTeam === 3) score_ct_at_round += 1;
    else if (winnerTeam === 2) score_t_at_round += 1;
    // Last-resort fallback: user_won + user_team (só funciona se rs existe)
    else if (rs && rs.user_team === 3 && rs.user_won) score_ct_at_round += 1;
    else if (rs && rs.user_team === 2 && rs.user_won) score_t_at_round += 1;
    else if (rs && rs.user_team === 3 && rs.user_won === false) score_t_at_round += 1;
    else if (rs && rs.user_team === 2 && rs.user_won === false) score_ct_at_round += 1;
  }

  return {
    rank: 0, // set por scoreKills após sort
    round_num,
    label: _roundLabel(n, roundKills, ctx),
    narrative: _roundNarrative(n, roundKills, ctx),
    score,
    start,
    end,
    kills: killInfos,
    alive_timeline: aliveTimeline,
    clutch_situation: ctx.clutch_situation,
    won_round: ctx.won_round,
    bomb_action: ctx.bomb_action,
    is_round_winning_kill: ctx.is_round_winning_kill,
    kill_ticks: roundKills.map((k) => k.tick),
    kill_timestamps: roundKills.map((k) => k.timestamp),
    bomb_action_tick: ctx.bomb_action_tick,
    bomb_action_timestamp: ctx.bomb_action_timestamp,
    bomb_planted_timestamp: ctx.bomb_planted_timestamp,
    // Sprint v5.7.15 — score AT esse round pra editor HUD não mostrar
    // sempre o final score em todos os highlights.
    score_ct_at_round,
    score_t_at_round,
  };
}

function _enrichWithRoundContext(
  seq: KillEvent[],
  events: ParsedDemoEvents,
  roundStateMap: Map<number, RoundState>,
  player_steamid: string,
): RoundContext {
  const ctx: RoundContext = {
    clutch_situation: null,
    won_round: false,
    bomb_action: null,
    is_round_winning_kill: false,
    bomb_action_tick: null,
    bomb_action_timestamp: null,
    bomb_planted_timestamp: null,
  };

  if (seq.length === 0) return ctx;

  const round_num = seq[0].round_num;
  const state = roundStateMap.get(round_num);
  if (!state) return ctx;

  ctx.won_round = !!state.user_won;

  // Round 4d 1.1 BUG FIX (Mathieu 30/04): defense-in-depth contra parser
  // bugs em user_won. Defuse sempre = team venceu (game logic CS2 hard
  // rule), então não precisa gateia em user_won — só verifica que user
  // defusou. Plant_won precisa gate (plant alone não vence; bomb pode ser
  // defused depois).
  //
  // Histórico: parser tinha off-by-one em winners[] (total_rounds_played+1
  // dava winners[R+1] em vez de winners[R]) → user_won false em rounds
  // que user defusou → bomb_action="defuse" silenciosamente skipped →
  // /match não mostrava badge. Fix do parser shipped em local_parser/
  // demo_parser.py, mas mantemos esse defense-in-depth aqui pra resilência
  // contra futuros bugs no derivation chain.
  if (player_steamid) {
    if (state.bomb_defused_by === player_steamid) {
      // Defuse SEMPRE = team venceu (CS2 game logic). Trust bomb_defused.
      ctx.bomb_action = "defuse";
    } else if (state.user_won && state.bomb_planted_by === player_steamid) {
      // Plant_won precisa team-won check (plant pode terminar com defuse).
      ctx.bomb_action = "plant_won";
    }

    // Sprint v5.7.13 (Mathieu 09/05/2026): "ele não identifica meu
    // defuse no scoring".
    // Root cause: parser v0.6.53 keep bomb_events com user_steamid vazio
    // (demoparser2 às vezes não extrai). Mas quando empty, state.bomb_*_by
    // fica "" → check estrito === player_steamid falha → defuse perdido.

    // Sprint v5.7.18 round 5 (Mathieu 11/05/2026, 7ª iteração defuse):
    // "desarmar bomba sem defuse no cs dura 10s, não tinha porque cortar
    // no meio". Diagnóstico: bomb_action ficava null mesmo com
    // bomb_action_timestamp populado → editor caía pro REACTION_PAD_SEC
    // default de 2s ao invés de 14s pra defuse → scene cortava 2s após
    // defuse complete. Causa: para Pro Demo Player Picker (HLTV demos):
    //   - parser não atribuía bomb_defused_by ao picked player
    //     (steamid vazio na event row)
    //   - orphan fallback exigia user_team === 3 + user_won
    //   - user_team era null pra round onde picked player teve 0 kills
    //   - orphan fallback skip → bomb_action permanece null
    //
    // Fix v5.7.18 round 5: bomb_action é EVENT-BASED, não player-based.
    // Se há bomb_defused event no round → bomb_action = "defuse" sempre
    // (round encerrou com defuse, scene deve mostrar até o final).
    // Se há bomb_planted SEM defuse + user T-side + user_won → "plant_won".
    // Não importa QUEM defusou — o que importa é que o ROUND encerrou
    // com aquela ação (afeta visualmente o final da scene).
    if (!ctx.bomb_action) {
      const hasDefuseInRound = events.bomb_events.some(
        (be) => be.round_num === round_num && be.action === "defused",
      );
      const hasPlantInRound = events.bomb_events.some(
        (be) => be.round_num === round_num && be.action === "planted",
      );
      if (hasDefuseInRound) {
        // Round terminou com defuse — visualmente é defuse closing.
        ctx.bomb_action = "defuse";
      } else if (hasPlantInRound && state.user_team === 2 && state.user_won) {
        // Plant sem defuse + user T-side + ganhou = plant_won.
        ctx.bomb_action = "plant_won";
      }
    }

    if (ctx.bomb_action) {
      const targetAction = ctx.bomb_action === "defuse" ? "defused" : "planted";
      // Sprint v5.7.10 (Mathieu PC diag 08/05): bomb_action_timestamp ficava
      // null mesmo com bomb_action setado. Causa: demoparser2 às vezes
      // emite bomb_planted/bomb_defused com user_steamid vazio (caso
      // de_mirage: 11/14 plants sem steamid). O filtro estrito
      // be.player_steamid === player_steamid fazia o loop não achar match.
      //
      // Fix 2-tier: PREFER match com player_steamid (mais preciso),
      // FALLBACK pra qualquer evento (round, action) — quando state já
      // confirmou bomb_action, sabemos que user fez a ação, não precisa
      // re-validar via steamid no event.
      let foundMatch = false;
      for (const be of events.bomb_events) {
        if (
          be.round_num === round_num &&
          be.action === targetAction &&
          be.player_steamid === player_steamid
        ) {
          ctx.bomb_action_tick = be.tick;
          ctx.bomb_action_timestamp = be.timestamp;
          foundMatch = true;
          break;
        }
      }
      // Fallback: ctx.bomb_action confirmado por round_state mas event
      // não tem steamid bate. Pega o primeiro event matching round+action.
      if (!foundMatch) {
        for (const be of events.bomb_events) {
          if (be.round_num === round_num && be.action === targetAction) {
            ctx.bomb_action_tick = be.tick;
            ctx.bomb_action_timestamp = be.timestamp;
            break;
          }
        }
      }
    }
  }

  // Sprint #6.2.1 (05/05) — bomb_planted_timestamp INDEPENDENTE de quem plantou.
  // Mathieu reportou: bomb timer red bar não aparecia em rounds que ele DEFUSOU.
  // Causa: editor checava `bomb_action === "plant_won"` como gate, mas em defuse
  // rounds bomb_action="defuse" e bomb_action_timestamp = defuse tick (não plant).
  // Fix: sempre populamos bomb_planted_timestamp se houve plant no round (qualquer
  // player). Editor usa esse field pra calcular timer 40s do plant_tick — funciona
  // pra plant_won (user planted), defuse (user defused, mas alguém plantou), ou
  // mero contexto (player rendering como spectator de round com plant).
  for (const be of events.bomb_events) {
    if (be.round_num === round_num && be.action === "planted") {
      ctx.bomb_planted_timestamp = be.timestamp;
      break;
    }
  }

  // Round-winning kill
  if (state.user_won && player_steamid) {
    const roundKillsChrono = events.kills
      .filter((k) => k.round_num === round_num)
      .sort((a, b) => a.tick - b.tick);
    if (roundKillsChrono.length > 0) {
      const lastKill = roundKillsChrono[roundKillsChrono.length - 1];
      if (
        lastKill.attacker_steamid === player_steamid &&
        lastKill.tick === seq[seq.length - 1].tick
      ) {
        ctx.is_round_winning_kill = true;
      }
    }
  }

  // 1vN clutch
  ctx.clutch_situation = _detectClutch(seq, state, events.kills, player_steamid);

  return ctx;
}

/**
 * Detect 1vN clutch — outcome-based, NOT cluster-position-based.
 *
 * Walk round kills chronologically maintaining alive counts. Detect when user
 * becomes sole survivor on his team with N≥2 enemies still alive. Then count
 * if user personally kills all N enemies.
 *
 * Defensive: returns null if team data missing or user_team unknown.
 */
function _detectClutch(
  seq: KillEvent[],
  state: RoundState,
  allKills: KillEvent[],
  player_steamid: string,
): ClutchSituation | null {
  if (!state.user_won || !state.user_team || !player_steamid) return null;

  const userTeam = state.user_team;
  const enemyTeam = userTeam === 2 ? 3 : 2;

  const roundKills = allKills
    .filter((k) => k.round_num === seq[0].round_num)
    .sort((a, b) => a.tick - b.tick);
  if (roundKills.length === 0) return null;

  // Need team info on every kill
  if (roundKills.some((k) => k.victim_team === null || k.victim_team === undefined)) {
    return null;
  }

  let aliveUser = TEAM_SIZE;
  let aliveEnemy = TEAM_SIZE;
  let userIsAlive = true;
  let clutchN: number | null = null;
  let userEnemyKillsDuringClutch = 0;

  for (const k of roundKills) {
    // Apply this kill's effect on alive counts FIRST
    if (k.victim_team === userTeam) {
      aliveUser -= 1;
      if (k.victim_steamid === player_steamid) {
        userIsAlive = false;
      }
    } else if (k.victim_team === enemyTeam) {
      aliveEnemy -= 1;
    }

    // Detect clutch start: user just became sole survivor (alive)
    if (clutchN === null && aliveUser === 1 && userIsAlive && aliveEnemy >= 2) {
      clutchN = aliveEnemy;
      // Don't count this kill (it was a teammate dying)
      continue;
    }

    // During clutch: count user's kills against enemies
    if (
      clutchN !== null &&
      k.attacker_steamid === player_steamid &&
      k.victim_team === enemyTeam
    ) {
      userEnemyKillsDuringClutch += 1;
    }
  }

  if (clutchN === null) return null;
  if (userEnemyKillsDuringClutch < clutchN) return null;
  if (aliveEnemy > 0) return null;

  const n = Math.min(clutchN, 5);
  if (n === 2) return "1v2";
  if (n === 3) return "1v3";
  if (n === 4) return "1v4";
  if (n === 5) return "1v5";
  return null;
}

// ── Labels ────────────────────────────────────────────────────────────────────

function _killLabel(kill: KillEvent): string {
  const weapon = weaponDisplay(kill.weapon);
  const parts = [weapon];
  if (kill.headshot) parts.push("HS");
  return parts.join(" · ");
}

function _roundLabel(n: number, roundKills: KillEvent[], ctx: RoundContext): string {
  const weapons = roundKills.map((k) => k.weapon.toLowerCase());
  const round_n = roundKills[0].round_num;

  let basePart: string;
  if (n >= 5) basePart = "ACE";
  else if (n === 4) basePart = "4K";
  else if (n === 3) basePart = "3K";
  else if (n === 2) basePart = "2K";
  else if (n === 1 && roundKills[0].headshot) {
    basePart = `${weaponDisplay(roundKills[0].weapon)} · HS`;
  } else {
    basePart = weaponDisplay(roundKills[0].weapon);
  }

  if (n >= 2) {
    if (weapons.some((w) => w.includes("knife"))) {
      basePart = `Knife ${basePart}`;
    } else if (weapons.every((w) => w === "awp" || w === "ssg08")) {
      basePart = `AWP ${basePart}`;
    }
  }

  const parts: string[] = [];
  if (ctx.clutch_situation) parts.push(`${ctx.clutch_situation} Clutch`);
  parts.push(basePart);
  if (ctx.bomb_action === "defuse") parts.push("Defuse");
  else if (ctx.bomb_action === "plant_won") parts.push("Plant");

  return `${parts.join(" + ")} · Round ${round_n}`;
}

function _multikillWordPt(n: number): string {
  if (n === 2) return "double";
  if (n === 3) return "triple";
  if (n === 4) return "quad";
  if (n === 5) return "ACE";
  return `${n}K`;
}

// Round 4d 1.2 (Mathieu 29/04, primeiro reel próprio): "as frases sao muito
// padronizadas e nao condizem com o round em si muitas vezes. Precisamos
// repensar". Versão antiga tinha 1 opening per scenario + cinemaBits parens
// = template óbvio. Usuários percebem logo que é "frase gerada".
//
// Nova versão (30/04 v0.6.7+):
// 1. Pool de openings com 3-5 variações por scenario, seleção determinística
//    via round_num (mesmo round → mesma frase, sem flicker entre re-renders)
// 2. Weapon-aware: AWP/knife/deagle/grenade têm flair próprio (vs apenas weapon name)
// 3. Headshot density: "todas na cabeça" vs "duas na cabeça" vs "headshot"
// 4. Clutch nuance: situação de site (B post-plant), HP crítico, time pressure
// 5. Defuse drama: "defusou no detalhe" se foi último ato; "fechou o round defusando"
// 6. RWK closing variations: "decisivo", "matou o último", "limpou o site"
// 7. Sentenças mais curtas e variadas — não tudo encaixado no mesmo molde
function _pickVariation<T>(pool: T[], seed: number): T {
  // Determinístico: mesmo round → mesma frase. Hash simples baseado em
  // round_num pra evitar Math.random() (não-determinístico) ou date-based.
  const idx = Math.abs(seed * 2654435761) % pool.length; // Knuth multiplicative
  return pool[idx];
}

function _headshotFlavor(roundKills: KillEvent[], n: number): string {
  const headshots = roundKills.filter((k) => k.headshot).length;
  if (headshots === 0) return "";
  if (n === 1) return "na cabeça";
  if (headshots === n) return "tudo na cabeça";
  if (headshots >= 2) return `${headshots} na cabeça`;
  return "uma na cabeça";
}

function _weaponFlair(roundKills: KillEvent[], n: number): string | null {
  // Pra solo kill, weapon vem no opening direto. Pra multi, retorna flair só
  // se for "weapon-defining" (todos AWP, todos faca, mistura especial).
  const weapons = roundKills.map((k) => k.weapon.toLowerCase());
  if (n === 1) return null;
  if (weapons.every((w) => w.includes("knife") || w.includes("bayonet"))) {
    return "tudo na facada";
  }
  if (weapons.every((w) => w === "awp" || w === "ssg08")) {
    return "tudo de AWP";
  }
  if (weapons.every((w) => w === "deagle")) {
    return "tudo de Deagle";
  }
  // Pistol round (R1/R13): todos pistola
  if (weapons.every((w) => /^(glock|usp|p2|p250|deagle|tec|five|cz|elite|hkp|revolver)/.test(w))) {
    return "no pistol";
  }
  return null;
}

function _roundNarrative(n: number, roundKills: KillEvent[], ctx: RoundContext): string {
  const wonRound = !!ctx.won_round;
  const rwk = !!ctx.is_round_winning_kill;
  const bomb = ctx.bomb_action;
  const clutch = ctx.clutch_situation;
  const round_n = roundKills[0].round_num;

  // Cinema flags pra usar nas variações
  const hasThrusmoke = roundKills.some((k) => k.thrusmoke === true);
  const hasNoscope = roundKills.some((k) => k.noscope === true);
  const hasWallbang = roundKills.some((k) => (k.penetrated ?? 0) > 0);
  const hasFlashed = roundKills.some((k) => k.attackerblind === true);
  const hasLowHp = roundKills.some(
    (k) =>
      k.attacker_health !== null &&
      k.attacker_health !== undefined &&
      k.attacker_health < LOW_HP_THRESHOLD,
  );

  // ── 1. Opening ────────────────────────────────────────────────────────────
  let opening: string;

  if (clutch) {
    const nEnemies = parseInt(clutch.slice(-1), 10);
    const won = n >= nEnemies;
    if (won && n === 1 && nEnemies === 1) {
      // 1v1 vencido
      opening = _pickVariation(
        [
          "Mano a mano, fechou em 1v1",
          "Duelo final — saiu vivo",
          "1v1 nervoso, garantiu o round",
          "Sozinho contra o último, não deixou escapar",
        ],
        round_n,
      );
    } else if (won) {
      // 1vN clutch convertido
      opening = _pickVariation(
        [
          `Sozinho contra ${nEnemies}, virou em clutch com ${_multikillWordPt(n)}`,
          `Clutch 1v${nEnemies} — ${_multikillWordPt(n)} e round fechado`,
          `1v${nEnemies}: ${_multikillWordPt(n)} pra fechar`,
          `Time tinha caído, sobrou ele — ${_multikillWordPt(n)} no clutch`,
        ],
        round_n,
      );
    } else if (n === 1) {
      // 1vN, matou 1, não fechou
      opening = _pickVariation(
        [
          `Tentou o clutch 1v${nEnemies} e levou 1 junto`,
          `Sozinho contra ${nEnemies} — caiu mas levou um inimigo`,
          `1v${nEnemies}: matou 1 antes de cair`,
        ],
        round_n,
      );
    } else {
      // 1vN, matou N (mas n < nEnemies)
      opening = _pickVariation(
        [
          `Clutch 1v${nEnemies} parcial — fez ${_multikillWordPt(n)}`,
          `Sozinho contra ${nEnemies}, fez ${_multikillWordPt(n)} antes de cair`,
        ],
        round_n,
      );
    }
  } else if (n === 1) {
    const kill = roundKills[0];
    const wep = weaponDisplay(kill.weapon);
    if (kill.headshot && (wep === "AWP" || wep === "Deagle")) {
      opening = _pickVariation(
        [
          `Headshot seco de ${wep}`,
          `${wep}, headshot, fim`,
          `1 tap de ${wep}`,
        ],
        round_n,
      );
    } else if (kill.headshot) {
      opening = _pickVariation(
        [
          `${wep} na cabeça`,
          `Headshot de ${wep}`,
          `Solo kill — ${wep} na cara`,
        ],
        round_n,
      );
    } else if (wep === "AWP") {
      opening = _pickVariation(
        ["AWP marcando presença", "Tiro limpo de AWP", "AWP, 1 frag"],
        round_n,
      );
    } else if (wep === "Faca" || wep === "Knife") {
      opening = _pickVariation(
        ["Kill na facada — humilhação", "Pegou na faca", "Facada cinematográfica"],
        round_n,
      );
    } else {
      opening = _pickVariation(
        [`Solo kill de ${wep}`, `1 frag de ${wep}`, `${wep}, kill solo`],
        round_n,
      );
    }
  } else {
    // Multikill (n >= 2)
    const word = _multikillWordPt(n);
    const wepFlair = _weaponFlair(roundKills, n);
    const hsFlavor = _headshotFlavor(roundKills, n);

    if (wepFlair) {
      opening = _pickVariation(
        [
          `${word} ${wepFlair}`,
          `${wepFlair} pra fazer ${word}`,
        ],
        round_n,
      );
    } else if (hsFlavor === "tudo na cabeça") {
      opening = _pickVariation(
        [
          `${word} ${hsFlavor}`,
          `${word} preciso — ${hsFlavor}`,
          `${hsFlavor}, ${word}`,
        ],
        round_n,
      );
    } else if (hsFlavor) {
      opening = _pickVariation(
        [
          `${word} (${hsFlavor})`,
          `${word} com ${hsFlavor}`,
        ],
        round_n,
      );
    } else if (n >= 4) {
      // 4K/ACE merece destaque sem ser genérico
      opening = _pickVariation(
        [
          `${word} no round`,
          `Round dele — ${word}`,
          `${word} dominante`,
        ],
        round_n,
      );
    } else {
      opening = _pickVariation(
        [
          `${word} no round`,
          `Pegou um ${word}`,
          `Round de ${word}`,
        ],
        round_n,
      );
    }
  }

  // ── 2. Bomb addon ────────────────────────────────────────────────────────
  let bombAddon = "";
  if (bomb === "defuse") {
    bombAddon = _pickVariation(
      clutch
        ? [
            "+ defuse no clutch",
            "e ainda defusou a bomba",
            "+ defuse pra completar",
          ]
        : [
            "e defusou a bomba",
            "+ defuse",
            "fechou defusando",
          ],
      round_n,
    );
  } else if (bomb === "plant_won") {
    bombAddon = _pickVariation(
      [
        "e plantou pro time fechar",
        "+ plant decisivo",
        "fechou armando a bomba",
      ],
      round_n,
    );
  }

  // ── 3. Cinema flair (sutil, não em parênteses obrigatório) ───────────────
  const cinemaBits: string[] = [];
  if (hasThrusmoke) cinemaBits.push("through smoke");
  if (hasNoscope) cinemaBits.push("no-scope");
  if (hasWallbang) cinemaBits.push("wallbang");
  if (hasFlashed) cinemaBits.push("flashado");
  if (hasLowHp && !clutch) cinemaBits.push("HP crítico");
  // Em clutches, HP crítico é ESPERADO, não cinema flair — evita redundância

  let cinemaStr = "";
  if (cinemaBits.length === 1) {
    cinemaStr = ` · ${cinemaBits[0]}`;
  } else if (cinemaBits.length > 1) {
    cinemaStr = ` · ${cinemaBits.join(", ")}`;
  }

  // ── 4. Closing ───────────────────────────────────────────────────────────
  let closing = "";
  if (rwk && !bomb && !clutch && n === 1) {
    closing = _pickVariation(
      [
        "— última kill, round fechou",
        "— matou o último",
        "— kill decisiva",
      ],
      round_n,
    );
  } else if (rwk && !bomb && !clutch && n >= 2) {
    closing = _pickVariation(
      [
        "— limpou o site",
        "— round fechou aí",
        "— kill final do round",
      ],
      round_n,
    );
  } else if (!wonRound && !clutch) {
    closing = _pickVariation(
      [
        "— time perdeu mesmo assim",
        "— round perdido apesar disso",
        "— mas time não conseguiu",
      ],
      round_n,
    );
  }

  // ── 5. Compose ────────────────────────────────────────────────────────────
  let sentence = opening;
  if (bombAddon) sentence += " " + bombAddon;
  sentence += cinemaStr;
  if (closing) sentence += " " + closing;

  sentence = sentence.trim();
  // Não força ponto final se já termina em outro punctuation (— closing)
  if (!/[.!?]$/.test(sentence)) sentence += ".";

  return sentence;
}

// ── Util ──────────────────────────────────────────────────────────────────────

function round(x: number): number {
  return Math.round(x);
}

/**
 * Banker's rounding (round half to even) — matches Python's `round(x, n)`
 * bit-exact. Sprint I.4 (28/04) PC test catched divergência Δ=0.100s entre
 * scorer Python (Railway) e scorer TS (Vercel) em valores `.x5` boundaries
 * porque JS `Math.round()` usa round-half-AWAY-from-zero (Math.round(0.5) = 1)
 * enquanto Python usa round-half-to-EVEN (round(0.5) = 0, round(1.5) = 2,
 * round(2.5) = 2, round(3.5) = 4).
 *
 * Implementação:
 * 1. scaled = x * 10^decimals
 * 2. floor = Math.floor(scaled)
 * 3. diff = scaled - floor
 * 4. Se diff < 0.5: round down (floor / factor)
 * 5. Se diff > 0.5: round up ((floor + 1) / factor)
 * 6. Se diff == 0.5 (within 1e-9 tolerance pra float precision):
 *    - floor par → round down (mantém par)
 *    - floor ímpar → round up (vira par)
 *
 * Tolerância 1e-9 pra absorver quirks de float precision (ex: 0.1+0.2=0.30000...004).
 *
 * Examples (decimals=1):
 *   roundBankers(730.25, 1) = 730.2  (Python: round(730.25, 1) = 730.2 ✓)
 *   roundBankers(730.35, 1) = 730.4  (Python: round(730.35, 1) = 730.4 ✓)
 *   roundBankers(730.15, 1) = 730.2  (Python: round(730.15, 1) = 730.2 ✓)
 *   roundBankers(730.21, 1) = 730.2  (round down normal)
 *   roundBankers(730.27, 1) = 730.3  (round up normal)
 */
function roundBankers(x: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const scaled = x * factor;
  const floorVal = Math.floor(scaled);
  const diff = scaled - floorVal;

  // Tolerance pra float precision quirks (ex: 0.1+0.2=0.30000...004)
  const HALF_EPS = 1e-9;

  if (diff < 0.5 - HALF_EPS) return floorVal / factor;
  if (diff > 0.5 + HALF_EPS) return (floorVal + 1) / factor;

  // diff ≈ 0.5: round to even
  // floor par → mantém par (round down)
  // floor ímpar → vira par (round up)
  return (floorVal % 2 === 0 ? floorVal : floorVal + 1) / factor;
}
