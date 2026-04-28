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

  const score = Math.round((base + bonus) * 10) / 10;

  // Round capture window
  const start = Math.max(0, round((roundKills[0].timestamp - ROUND_PRE_BUFFER) * 10) / 10);
  let end = round((roundKills[roundKills.length - 1].timestamp + ROUND_POST_BUFFER) * 10) / 10;
  if (end - start < MIN_CLIP_LEN) {
    end = round((start + MIN_CLIP_LEN) * 10) / 10;
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

  // Bomb action (only counts if user did it AND team won)
  if (state.user_won && player_steamid) {
    if (state.bomb_defused_by === player_steamid) {
      ctx.bomb_action = "defuse";
    } else if (state.bomb_planted_by === player_steamid) {
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

function _roundNarrative(n: number, roundKills: KillEvent[], ctx: RoundContext): string {
  const wonRound = !!ctx.won_round;
  const rwk = !!ctx.is_round_winning_kill;
  const bomb = ctx.bomb_action;
  const clutch = ctx.clutch_situation;

  // 1. Opening — ação principal
  let opening: string;
  if (clutch) {
    const nEnemies = parseInt(clutch.slice(-1), 10);
    if (n === 1 && nEnemies === 1) {
      opening = "Sozinho contra 1, matou o último";
    } else if (n === 1) {
      opening = `Sozinho contra ${nEnemies}, matou 1`;
    } else if (n >= nEnemies) {
      opening = `Sozinho contra ${nEnemies}, fez ${_multikillWordPt(n)} pra virar o round em clutch`;
    } else {
      opening = `Sozinho contra ${nEnemies}, fez ${_multikillWordPt(n)}`;
    }
  } else if (n === 1) {
    const kill = roundKills[0];
    const wep = weaponDisplay(kill.weapon);
    opening = kill.headshot ? `Solo kill de ${wep} na cabeça` : `Solo kill de ${wep}`;
  } else {
    opening = `Pegou um ${_multikillWordPt(n)}`;
  }

  // 2. Bomb addon
  let bombAddon = "";
  if (bomb === "defuse") {
    bombAddon = clutch ? "e ainda defusou a bomba" : "e defusou a bomba";
  } else if (bomb === "plant_won") {
    bombAddon = "e plantou pro time fechar";
  }

  // 3. Cinema flair
  const cinemaBits: string[] = [];
  if (roundKills.some((k) => k.thrusmoke === true)) cinemaBits.push("through smoke");
  if (roundKills.some((k) => k.noscope === true)) cinemaBits.push("no-scope");
  if (roundKills.some((k) => (k.penetrated ?? 0) > 0)) cinemaBits.push("wallbang");
  if (roundKills.some((k) => k.attackerblind === true)) cinemaBits.push("flashado");
  if (
    roundKills.some(
      (k) =>
        k.attacker_health !== null &&
        k.attacker_health !== undefined &&
        k.attacker_health < LOW_HP_THRESHOLD,
    )
  ) {
    cinemaBits.push("HP crítico");
  }
  const cinemaStr = cinemaBits.length > 0 ? ` (${cinemaBits.join(", ")})` : "";

  // 4. Closing
  let closing = "";
  if (rwk && !bomb && !clutch) {
    closing = "— a kill que fechou o round";
  } else if (rwk && clutch) {
    closing = "";
  } else if (!wonRound) {
    closing = "— time perdeu o round mesmo assim";
  }

  // Compose
  let sentence = opening;
  if (bombAddon) sentence += " " + bombAddon;
  sentence += cinemaStr;
  if (closing) sentence += " " + closing;

  sentence = sentence.trim();
  if (!sentence.endsWith(".")) sentence += ".";

  return sentence;
}

// ── Util ──────────────────────────────────────────────────────────────────────

function round(x: number): number {
  return Math.round(x);
}
