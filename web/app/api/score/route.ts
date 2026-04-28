/**
 * POST /api/score — Highlight scoring endpoint (STUB v1).
 *
 * Recebe eventos parseados de um demo CS2 e retorna uma lista ranqueada de
 * highlights. Esse é o ENDPOINT que vai conter a "inteligência" do FragReel
 * (scorer + cluster + cinema events) num futuro próximo, mantendo a lógica
 * de negócio fora do client OSS público.
 *
 * Status atual: STUB. Retorna mock highlights pra validar a arquitetura
 * client→API. O scorer Python real (api/parser/scorer.py do repo backend
 * Railway) ainda roda no client e/ou no FastAPI legado.
 *
 * Plano de migração:
 *   Fase A (agora) — stub responde 200 + mock highlights. Client tem
 *     fallback offline via scorer local. API call é OPT-IN via env var.
 *   Fase B — porta scorer.py + cluster_v2.py pra TypeScript aqui (ou
 *     chama subprocess Python via Vercel Function). Client começa a
 *     usar prod.
 *   Fase C — scorer LOCAL no client vira fallback "lite" (top kills sem
 *     bonuses) só pra offline. Logic principal vive no servidor.
 *   Fase D — auth + rate limit + telemetry agregada (sem PII).
 *
 * Contrato do request body:
 *   {
 *     "schema_version": "1",
 *     "client_version": "v0.4.x",
 *     "demo_meta": { "map": "de_dust2", "tickrate": 64.0, "match_id": "..." },
 *     "player_steamid": "76561198...",
 *     "events": {
 *       "kills":    [{tick, timestamp, attacker_steamid, victim_steamid,
 *                      victim_team, weapon, headshot, attacker_health, ...}, ...],
 *       "rounds":   [{round_num, user_won, user_team,
 *                      bomb_planted_by, bomb_defused_by}, ...],
 *       "bomb_events": [{round_num, action, player_steamid, tick, timestamp}, ...]
 *     }
 *   }
 *
 * Contrato do response (success):
 *   {
 *     "schema_version": "1",
 *     "highlights": [
 *       {
 *         "rank": 1, "round_num": 12, "label": "1v3 Clutch + Defuse · Round 12",
 *         "narrative": "Sozinho contra 3, fez triple e defusou a bomba.",
 *         "score": 2150.0, "start": 740.5, "end": 768.0,
 *         "clutch_situation": "1v3", "won_round": true,
 *         "bomb_action": "defuse", "is_round_winning_kill": true,
 *         "kill_ticks": [...], "kill_timestamps": [...],
 *         "kills": [...], "alive_timeline": [...]
 *       },
 *       ...
 *     ],
 *     "scorer_version": "stub-v1"
 *   }
 *
 * Erros:
 *   400 — body inválido (schema check)
 *   413 — payload > 10MB (anti-abuse)
 *   500 — erro interno (client deve cair pra fallback offline)
 */

import { NextRequest, NextResponse } from "next/server";

// Permite até 30s de execução (default Vercel é 10s). Edge runtime tem
// limites mais agressivos — Node runtime pra ter espaço pra futuro scorer
// pesado em TS/WASM.
export const runtime = "nodejs";
export const maxDuration = 30;

const SCHEMA_VERSION = "1";
const SCORER_VERSION = "stub-v1";
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB (events JSON p/ partida 1h-ish)

interface ScoreRequest {
  schema_version: string;
  client_version: string;
  demo_meta: {
    map: string;
    tickrate: number;
    match_id?: string;
  };
  player_steamid: string;
  events: {
    kills: Array<{
      tick: number;
      timestamp: number;
      attacker_steamid: string;
      victim_steamid: string;
      victim_team: number | null;
      weapon: string;
      headshot: boolean;
      attacker_health?: number;
      round_num: number;
      // Cinema flags (v0.3.1+)
      thrusmoke?: boolean;
      noscope?: boolean;
      penetrated?: number;
      attackerblind?: boolean;
    }>;
    rounds: Array<{
      round_num: number;
      user_won: boolean;
      user_team: number | null;
      bomb_planted_by?: string;
      bomb_defused_by?: string;
    }>;
    bomb_events: Array<{
      round_num: number;
      action: "planted" | "defused" | "exploded";
      player_steamid: string;
      tick: number;
      timestamp: number;
    }>;
  };
}

export async function POST(req: NextRequest) {
  // Anti-abuse: bloqueia payload gigante antes de parsear.
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "payload_too_large", max_bytes: MAX_BODY_BYTES },
      { status: 413 },
    );
  }

  let body: ScoreRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Validação mínima do schema. Validação completa virá com zod na Fase B.
  if (body.schema_version !== SCHEMA_VERSION) {
    return NextResponse.json(
      { error: "schema_version_mismatch", expected: SCHEMA_VERSION, got: body.schema_version },
      { status: 400 },
    );
  }
  if (!body.events?.kills || !Array.isArray(body.events.kills)) {
    return NextResponse.json({ error: "events.kills_required" }, { status: 400 });
  }
  if (!body.player_steamid) {
    return NextResponse.json({ error: "player_steamid_required" }, { status: 400 });
  }

  // ── STUB SCORING ────────────────────────────────────────────────────────
  // Retorna highlights mock baseados em kills agrupadas por round, ranqueadas
  // por kill count (sem bonuses). Suficiente pra validar contrato client↔API.
  //
  // PRÓXIMO: portar score_kills() de api/parser/scorer.py pra cá. Dá pra
  // fazer 1:1 em TS porque a lógica é puramente determinística sobre eventos.
  // ─────────────────────────────────────────────────────────────────────────
  const highlights = computeStubHighlights(body);

  return NextResponse.json(
    {
      schema_version: SCHEMA_VERSION,
      scorer_version: SCORER_VERSION,
      highlights,
    },
    {
      status: 200,
      headers: {
        // Permite o client desktop chamar de qualquer origin (não tem CORS
        // pq não roda em browser, mas defensivo se chamado de DevTools).
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ── STUB IMPL ─────────────────────────────────────────────────────────────

interface MockHighlight {
  rank: number;
  round_num: number;
  label: string;
  narrative: string;
  score: number;
  start: number;
  end: number;
  clutch_situation: string | null;
  won_round: boolean;
  bomb_action: string | null;
  is_round_winning_kill: boolean;
  kill_ticks: number[];
  kill_timestamps: number[];
  kills: Array<{ label: string; weapon: string; headshot: boolean }>;
  alive_timeline: never[];
}

function computeStubHighlights(body: ScoreRequest): MockHighlight[] {
  const { events, player_steamid } = body;
  const userKills = events.kills.filter((k) => k.attacker_steamid === player_steamid);

  // Agrupa por round.
  const byRound = new Map<number, typeof userKills>();
  for (const k of userKills.sort((a, b) => a.tick - b.tick)) {
    const arr = byRound.get(k.round_num) ?? [];
    arr.push(k);
    byRound.set(k.round_num, arr);
  }

  // STUB: score = kills * 100 + headshots * 20. Sem clutch detection,
  // sem bomb bonuses, sem cinema events. Suficiente pra validar pipeline.
  const baseScores: Record<number, number> = { 1: 30, 2: 150, 3: 400, 4: 700, 5: 1000 };

  const rounds = Array.from(byRound.entries()).map(([roundNum, kills]) => {
    const n = kills.length;
    const base = baseScores[Math.min(n, 5)] ?? 1000;
    const hsBonus = kills.filter((k) => k.headshot).length * 20;
    const score = base + hsBonus;

    return {
      round_num: roundNum,
      kills,
      score,
    };
  });

  rounds.sort((a, b) => b.score - a.score);

  return rounds.slice(0, 10).map((r, i) => {
    const first = r.kills[0];
    const last = r.kills[r.kills.length - 1];
    const n = r.kills.length;
    const tag = n >= 5 ? "ACE" : n === 4 ? "4K" : n === 3 ? "3K" : n === 2 ? "2K" : "Solo";

    return {
      rank: i + 1,
      round_num: r.round_num,
      label: `${tag} · Round ${r.round_num}`,
      narrative: `${n === 1 ? "Solo kill" : `Pegou ${tag === "ACE" ? "ACE" : tag.toLowerCase()}`}.`,
      score: r.score,
      start: Math.max(0, first.timestamp - 15),
      end: last.timestamp + 5,
      clutch_situation: null,
      won_round: false,
      bomb_action: null,
      is_round_winning_kill: false,
      kill_ticks: r.kills.map((k) => k.tick),
      kill_timestamps: r.kills.map((k) => k.timestamp),
      kills: r.kills.map((k) => ({
        label: `${k.weapon}${k.headshot ? " · HS" : ""}`,
        weapon: k.weapon,
        headshot: k.headshot,
      })),
      alive_timeline: [],
    };
  });
}
