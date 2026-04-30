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

// ── Public API ────────────────────────────────────────────────────────────────

export interface ScoreInput {
  events: ParsedDemoEvents;
  player_steamid: string;
  tickrate: number; // pra converter tick → segundos quando demo não traz timestamps
}

/**
 * Score and rank user-played ROUNDS into highlights.
 *
 * Returns up to MAX_HIGHLIGHTS, sorted by score descending. Each highlight =
 * 1 round where user got ≥1 kill. Cliente recebe kill_ticks/kill_timestamps
 * pra aplicar cluster algorithm local (gap=10s, pad=±5s/±3.5s).
 */
export function scoreKills(input: ScoreInput): Highlight[] {
  const { events, player_steamid, tickrate } = input;
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

  const scored: Highlight[] = [];
  for (const [round_num, roundKills] of byRound.entries()) {
    scored.push(
      _scoreRound(roundKills, round_num, events, roundStateMap, player_steamid, tickrate),
    );
  }

  // Sort desc by score, assign ranks 1..N
  scored.sort((a, b) => b.score - a.score);
  for (let i = 0; i < scored.length; i++) {
    scored[i].rank = i + 1;
  }

  return scored.slice(0, MAX_HIGHLIGHTS);
}

// ── Internals ────────────────────────────────────────────────────────────────

function _scoreRound(
  roundKills: KillEvent[],
  round_num: number,
  events: ParsedDemoEvents,
  roundStateMap: Map<number, RoundState>,
  player_steamid: string,
  tickrate: number,
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

    killInfos.push({
      label: _killLabel(kill),
      weapon: kill.weapon,
      headshot: kill.headshot,
      attacker_health: kill.attacker_health ?? null,
      alive_ct_after: Math.max(0, 5 - ctDeaths),
      alive_t_after: Math.max(0, 5 - tDeaths),
      time: kill.tick / tr,
    });
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

    if (ctx.bomb_action) {
      const targetAction = ctx.bomb_action === "defuse" ? "defused" : "planted";
      for (const be of events.bomb_events) {
        if (
          be.round_num === round_num &&
          be.action === targetAction &&
          be.player_steamid === player_steamid
        ) {
          ctx.bomb_action_tick = be.tick;
          ctx.bomb_action_timestamp = be.timestamp;
          break;
        }
      }
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
