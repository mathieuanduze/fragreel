/**
 * POST /api/score — Highlight scoring endpoint (REAL, Sprint I.3).
 *
 * Sprint I.3 (28/04): porta scorer.py Python pra TypeScript local. Cliente
 * envia eventos parseados, API retorna highlights ranqueados com toda a
 * lógica de scoring v0.3.1+ (clutch detection, bomb bonuses, RWK, cinema
 * events: thrusmoke/noscope/wallbang/blind/low-HP).
 *
 * Lógica vive em ./lib/scorer.ts (port 1:1 de api/parser/scorer.py).
 *
 * Contrato request body:
 *   {
 *     "schema_version": "1",
 *     "client_version": "v0.4.x",
 *     "demo_meta": { "map": "de_dust2", "tickrate": 64.0, "match_id": "..." },
 *     "player_steamid": "76561198...",
 *     "events": {
 *       "kills":    KillEvent[],
 *       "rounds":   RoundState[],
 *       "bomb_events": BombEvent[]
 *     }
 *   }
 *
 * Response 200:
 *   {
 *     "schema_version": "1",
 *     "scorer_version": "v0.3.1-port-1",
 *     "highlights": Highlight[]    // até 10, sorted desc
 *   }
 *
 * Errors:
 *   400 — schema mismatch / payload inválido
 *   413 — payload > 10MB
 *   500 — erro interno (client cai pro fallback offline LITE)
 */

import { NextRequest, NextResponse } from "next/server";
import { scoreKills } from "./lib/scorer";
import type { ParsedDemoEvents } from "./lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const SCHEMA_VERSION = "1";
// 07/05 — bump SCORER_VERSION pra Sprint #6.5 + Aesthetic. Client api_client.py
// loga isso pra detectar deploy stale (response com versão antiga = Vercel
// cache hit serving old code).
const SCORER_VERSION = "v0.6.5-aesthetic-pov-wide";
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

interface ScoreRequest {
  schema_version: string;
  client_version: string;
  demo_meta: {
    map: string;
    tickrate: number;
    match_id?: string;
  };
  player_steamid: string;
  events: ParsedDemoEvents;
  /** Sprint #6.5 (06/05) — roster steamid → name pra POV cuts.
   *  Opcional pra back-compat com clients antigos. Sem roster, scorer skip
   *  pov_eligible (victim_name undefined → capture.cfg não emite switch). */
  roster?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  // Anti-abuse: bloqueia payload gigante antes de parsear
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

  // Schema validation
  if (body.schema_version !== SCHEMA_VERSION) {
    return NextResponse.json(
      {
        error: "schema_version_mismatch",
        expected: SCHEMA_VERSION,
        got: body.schema_version,
      },
      { status: 400 },
    );
  }
  if (!body.events?.kills || !Array.isArray(body.events.kills)) {
    return NextResponse.json({ error: "events.kills_required" }, { status: 400 });
  }
  if (!body.events?.rounds || !Array.isArray(body.events.rounds)) {
    return NextResponse.json({ error: "events.rounds_required" }, { status: 400 });
  }
  if (!body.events?.bomb_events || !Array.isArray(body.events.bomb_events)) {
    return NextResponse.json({ error: "events.bomb_events_required" }, { status: 400 });
  }
  if (!body.player_steamid || typeof body.player_steamid !== "string") {
    return NextResponse.json({ error: "player_steamid_required" }, { status: 400 });
  }
  if (!body.demo_meta?.tickrate || body.demo_meta.tickrate <= 0) {
    return NextResponse.json({ error: "demo_meta.tickrate_required" }, { status: 400 });
  }

  // ── REAL SCORING ─────────────────────────────────────────────────────────
  let highlights;
  try {
    highlights = scoreKills({
      events: body.events,
      player_steamid: body.player_steamid,
      tickrate: body.demo_meta.tickrate,
      roster: body.roster,
    });
  } catch (e) {
    console.error("[/api/score] scoreKills threw", e);
    return NextResponse.json(
      {
        error: "scorer_error",
        message: (e as Error).message ?? "unknown",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      schema_version: SCHEMA_VERSION,
      scorer_version: SCORER_VERSION,
      highlights,
    },
    {
      status: 200,
      headers: {
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

export async function GET() {
  // Healthcheck — útil pra Mathieu testar manualmente que endpoint tá vivo
  return NextResponse.json({
    status: "ok",
    schema_version: SCHEMA_VERSION,
    scorer_version: SCORER_VERSION,
    method: "POST eventos parseados pra scoring real, ou GET /api/score pra healthcheck",
  });
}
