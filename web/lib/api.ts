const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function authHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("fragreel_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface KillOut {
  label: string;
  weapon: string;
  headshot: boolean;
  hp: number;
}

export interface HighlightOut {
  rank: number;
  round_num: number;
  label: string;
  score: number;
  start: number;
  end: number;
  kills: KillOut[];
}

export interface MatchStats {
  kd: string;
  hs: string;
  adr: string;
  rating: string;
}

export interface MatchOut {
  id: string;
  map: string;
  date: string;
  score: string;
  side: string;
  status: string;
  stats: MatchStats;
  highlights: HighlightOut[];
}

export interface MatchSummary {
  id: string;
  map: string;
  date: string;
  score: string;
  side: string;
  status: string;
  highlights_count: number;
  top_play: string;
  rating: string;
  kd: string;
}

export interface GenerateResponse {
  job_id: string;
  status: string;
  estimated_seconds: number;
  message: string;
}

export async function getMatches(): Promise<MatchSummary[]> {
  const res = await fetch(`${BASE}/matches`, {
    cache: "no-store",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("Failed to fetch matches");
  return res.json();
}

export async function getMatch(id: string): Promise<MatchOut> {
  const res = await fetch(`${BASE}/matches/${id}`, {
    cache: "no-store",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("Failed to fetch match");
  return res.json();
}

export async function generateVideo(
  matchId: string,
  format: string,
  highlightRanks: number[]
): Promise<GenerateResponse> {
  const res = await fetch(`${BASE}/matches/${matchId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ format, highlight_ranks: highlightRanks }),
  });
  if (!res.ok) throw new Error("Failed to generate video");
  return res.json();
}
