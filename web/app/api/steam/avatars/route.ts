/**
 * Steam Avatar Lookup — Vercel function.
 *
 * Recebe lista de steamids e retorna mapa { steamid → avatarmedium URL }
 * via Steam Web API GetPlayerSummaries. Mantém STEAM_WEB_API_KEY
 * server-side (não expõe no browser).
 *
 * Used by DemosAnalisadasClient pra render player cards com fotos
 * Steam reais (não initials placeholder).
 *
 * Rate limit Valve: 100k req/day por API key. Cada call cobre até 100
 * steamids. UX típica do FragReel: 10 players/demo, 1 demo selecionada
 * por vez → ~10 lookups por sessão. Bem dentro do limite.
 */

import { NextRequest, NextResponse } from "next/server";

const VALVE_API =
  "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/";
const MAX_STEAMIDS_PER_CALL = 100; // Valve hard limit

interface SteamPlayer {
  steamid: string;
  avatarmedium?: string;
  avatar?: string;
  avatarfull?: string;
  personaname?: string;
}

interface ValveResponse {
  response?: {
    players?: SteamPlayer[];
  };
}

export async function POST(req: NextRequest) {
  let body: { steamids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const steamids = (body.steamids || [])
    .filter((s): s is string => typeof s === "string" && /^\d{17}$/.test(s))
    .slice(0, MAX_STEAMIDS_PER_CALL);

  if (steamids.length === 0) {
    return NextResponse.json({ avatars: {} });
  }

  const apiKey = process.env.STEAM_WEB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig_missing_steam_api_key", avatars: {} },
      { status: 500 },
    );
  }

  const url = new URL(VALVE_API);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamids", steamids.join(","));

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "fragreel-web/1.0" },
      // Cache 5min — avatares mudam raramente, reduz chamadas Valve.
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `valve_api_${res.status}`, avatars: {} },
        { status: 502 },
      );
    }

    const data = (await res.json()) as ValveResponse;
    const players = data.response?.players || [];

    const avatars: Record<string, string> = {};
    for (const p of players) {
      const url = p.avatarmedium || p.avatarfull || p.avatar;
      if (url) avatars[p.steamid] = url;
    }

    return NextResponse.json({ avatars });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, avatars: {} },
      { status: 502 },
    );
  }
}
