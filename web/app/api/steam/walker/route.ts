/**
 * Steam Sharecode Walker — Vercel function.
 *
 * Chama `GetNextMatchSharingCode` da Valve em loop pra descobrir sharecodes
 * novos a partir de um anchor. Retorna lista até 30 matches (limite seguro
 * pra não estourar timeout Vercel — 10s default em hobby plan).
 *
 * Endpoint Valve:
 *   GET /ICSGOPlayers_730/GetNextMatchSharingCode/v1/
 *     ?key={WEB_API_KEY}
 *     &steamid={steamid64}
 *     &steamidkey={authCode}    ← user's match token
 *     &knowncode={lastSharecode}
 *
 * Response:
 *   { result: { nextcode: "CSGO-XXXXX-..." } } ou
 *   { result: { nextcode: "n/a" } } quando esgotou
 *
 * Rate limit: Valve tolera ~1 req/sec por API key. Como cada walk faz N
 * chamadas sequenciais, limitamos a 30 matches por walk pra ficar < 10s.
 *
 * Sprint DEMO-3 v3 (2026-05-08): substitui call ao bot 24/7.
 */

import { NextRequest, NextResponse } from "next/server";

const VALVE_API_BASE =
  "https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1";
const MAX_WALK_ITERATIONS = 30;
// Throttle entre chamadas Valve (ms) — anti-rate-limit conservador.
const WALK_DELAY_MS = 250;

interface WalkRequest {
  steamid: string;
  authCode: string;
  knownCode: string;
}

interface WalkResponse {
  newSharecodes: string[];
  lastKnown: string;
  exhausted: boolean;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNextSharecode(
  apiKey: string,
  steamid: string,
  authCode: string,
  knownCode: string,
): Promise<string | null> {
  const url = new URL(VALVE_API_BASE);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamid);
  url.searchParams.set("steamidkey", authCode);
  url.searchParams.set("knowncode", knownCode);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "fragreel-web/1.0" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`valve_api_${res.status}`);
  }

  const data = (await res.json()) as {
    result?: { nextcode?: string };
  };

  const next = data.result?.nextcode;
  if (!next || next === "n/a" || next === "") return null;
  return next;
}

export async function POST(req: NextRequest) {
  let body: WalkRequest;
  try {
    body = (await req.json()) as WalkRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { steamid, authCode, knownCode } = body;

  if (!steamid || !authCode || !knownCode) {
    return NextResponse.json(
      { error: "missing_fields", required: ["steamid", "authCode", "knownCode"] },
      { status: 400 },
    );
  }

  const apiKey = process.env.STEAM_WEB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig_missing_steam_api_key" },
      { status: 500 },
    );
  }

  const collected: string[] = [];
  let cursor = knownCode;
  let exhausted = false;

  try {
    for (let i = 0; i < MAX_WALK_ITERATIONS; i++) {
      const next = await fetchNextSharecode(apiKey, steamid, authCode, cursor);
      if (!next) {
        exhausted = true;
        break;
      }
      collected.push(next);
      cursor = next;
      if (i < MAX_WALK_ITERATIONS - 1) await sleep(WALK_DELAY_MS);
    }
  } catch (e) {
    // Retorna parcial — frontend persiste o que veio + lastKnown atualizado.
    const response: WalkResponse = {
      newSharecodes: collected,
      lastKnown: cursor,
      exhausted: false,
      error: (e as Error).message,
    };
    return NextResponse.json(response, { status: 502 });
  }

  const response: WalkResponse = {
    newSharecodes: collected,
    lastKnown: cursor,
    exhausted,
  };
  return NextResponse.json(response);
}
