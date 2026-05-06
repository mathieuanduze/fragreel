/**
 * Tipos espelhando api/parser/demo_parser.py + scorer.py.
 *
 * Source of truth do shape do request/response da API /api/score. Cliente
 * (api_client.py) e endpoint compartilham contrato via SCHEMA_VERSION — bump
 * conjunto quando shape muda.
 *
 * Convenção victim_team / user_team:
 *   2 = T (Terrorist)
 *   3 = CT (Counter-Terrorist)
 *   null = info ausente (demo antigo / parser falhou)
 */

// ── Eventos parseados do demo (input do scoring) ──────────────────────────────

export interface KillEvent {
  tick: number;
  timestamp: number; // segundos desde início do demo
  round_num: number; // 1-indexed
  weapon: string; // sem prefix "weapon_"
  headshot: boolean;
  attacker_steamid: string;
  victim_steamid: string;
  attacker_team?: number | null; // 2=CT 3=T
  victim_team?: number | null;
  // Cinema flags v0.3.1 — defaults false/0/null pra demos antigas
  noscope?: boolean;
  thrusmoke?: boolean;
  penetrated?: number;
  attackerblind?: boolean;
  attackerinair?: boolean;
  distance?: number | null;
  attacker_health?: number | null;
}

export interface BombEvent {
  tick: number;
  timestamp: number;
  round_num: number;
  player_steamid: string;
  action: "planted" | "defused" | "exploded";
}

export interface RoundState {
  round_num: number;
  winner_team?: number | null;
  bomb_planted_by?: string | null;
  bomb_defused_by?: string | null;
  user_team?: number | null;
  user_won: boolean;
}

export interface ParsedDemoEvents {
  kills: KillEvent[];
  rounds: RoundState[]; // virá serializado como array, é dict no Python
  bomb_events: BombEvent[];
}

export interface DemoMeta {
  map: string;
  tickrate: number;
  match_id?: string | null;
}

// ── Output do scoring ────────────────────────────────────────────────────────

/** Sprint Aesthetic Kill Scoring (06/05) — visual style aplicado em cima
 *  de kills mais bonitas. Editor renderiza efeito específico por tipo:
 *    - noscope: AWP sem zoom (super raro + ballsy)
 *    - knife:   knife kill (rare + ballsy)
 *    - wallbang: bullet penetrou parede (penetrated > 0)
 *    - smoke:   tiro através de smoke (thrusmoke)
 *    - blind:   atacante cego (attackerblind, flashbang antes)
 *    - flick:   high score genérico (low HP win, headshot premium, etc)
 *    - null:    kill comum, sem efeito visual extra
 *
 *  Per-style visual mapping (HighlightScene aplica):
 *    noscope → flash dourado + zoom suave
 *    knife   → color grade quente + screen shake leve
 *    wallbang → flash branco rápido + x-ray pulse
 *    smoke   → flash azul claro
 *    blind   → flash branco overpoder
 *    flick   → flash laranja (mesmo do Sprint #6.1 mas só nas top kills)
 */
export type KillAestheticStyle = "noscope" | "knife" | "wallbang" | "smoke" | "blind" | "flick" | null;

export interface KillInfo {
  label: string;
  weapon: string;
  headshot: boolean;
  hp?: number;
  // Narrative context pra título dinâmico do Remotion (Fase 1.23)
  attacker_health?: number | null;
  alive_ct_after?: number | null;
  alive_t_after?: number | null;
  time?: number | null; // tick em segundos
  /** Sprint Aesthetic (06/05) — score técnico/estético da kill (0-N).
   *  Não confundir com `Highlight.score` (round score). Per-kill score que
   *  considera weapon rarity (AWP/knife/pistol HS), execution quality
   *  (noscope, wallbang, through smoke, blind), state (low HP win,
   *  long range). Editor usa pra decidir estilo visual + threshold de
   *  cinematic effect. */
  aesthetic_score?: number;
  /** Sprint Aesthetic (06/05) — style hint pro editor renderizar efeito
   *  visual específico. null = kill comum sem efeito. Set quando
   *  aesthetic_score cruza threshold + tipo de execução é identificável. */
  aesthetic_style?: KillAestheticStyle;
}

export interface AliveEvent {
  /** Timeline (Fase 1.27) — single death event no round.
   *  Inclui deaths de teammates + enemies pra contagem precisa. */
  time: number;
  alive_ct: number;
  alive_t: number;
}

export interface Highlight {
  rank: number;
  round_num: number;
  label: string;
  narrative: string;
  score: number;
  start: number;
  end: number;
  kills: KillInfo[];
  alive_timeline: AliveEvent[];
  clutch_situation: ClutchSituation | null; // "1v2" | "1v3" | "1v4" | "1v5"
  won_round: boolean;
  bomb_action: BombAction | null; // "defuse" | "plant_won"
  is_round_winning_kill: boolean;
  kill_ticks: number[];
  kill_timestamps: number[];
  bomb_action_tick?: number | null;
  bomb_action_timestamp?: number | null;
  /** Sprint #6.2.1 (05/05) — plant_tick INDEPENDENTE de quem plantou.
   *  Editor usa pra bomb timer red bar funcionar em defuse rounds (onde
   *  bomb_action_timestamp = defuse tick, não plant). Null se round
   *  não teve plant. */
  bomb_planted_timestamp?: number | null;
}

export type ClutchSituation = "1v2" | "1v3" | "1v4" | "1v5";
export type BombAction = "defuse" | "plant_won";

// ── Round context helper (interno do scorer) ──────────────────────────────────

export interface RoundContext {
  clutch_situation: ClutchSituation | null;
  won_round: boolean;
  bomb_action: BombAction | null;
  is_round_winning_kill: boolean;
  bomb_action_tick: number | null;
  bomb_action_timestamp: number | null;
  /** Sprint #6.2.1 — plant tick INDEPENDENTE de quem plantou. */
  bomb_planted_timestamp: number | null;
}
