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
  clip_url?: string | null;
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

export type Mood = "eletronica" | "acao" | "heroico" | "chill";

// vertical = TikTok / Reels / Shorts (1080x1920)
// horizontal = YouTube / Twitch (1920x1080)
export type Orientation = "vertical" | "horizontal";

export interface GenerateResponse {
  job_id: string;
  status: string;
  estimated_seconds: number;
  message: string;
  render_url?: string | null;
  status_url?: string | null;
}

export interface RenderStatus {
  job_id: string;
  match_id: string;
  format: string;
  status: "pending" | "rendering" | "done" | "error";
  progress: number;
  path?: string | null;
  error?: string | null;
  started_at: number;
  finished_at?: number | null;
}

export async function getRenderStatus(
  matchId: string,
  format: string
): Promise<RenderStatus> {
  const res = await fetch(`${BASE}/renders/${matchId}/${format}/status`, {
    cache: "no-store",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("Render status not available");
  return res.json();
}

export function renderDownloadUrl(matchId: string, format: string): string {
  return `${BASE}/renders/${matchId}/${format}`;
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

export interface UploadDemoResponse {
  status: string;
  match_id: string;
  map?: string;
  kills?: number;
  highlights?: number;
  message?: string;
}

export async function uploadDemo(
  file: File,
  steamid: string,
  onProgress?: (pct: number) => void
): Promise<UploadDemoResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/demo/upload?steamid=${encodeURIComponent(steamid)}`);

    const token = typeof window !== "undefined" ? localStorage.getItem("fragreel_token") : null;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText || "Upload falhou"));
      }
    };
    xhr.onerror = () => reject(new Error("Erro de rede"));
    xhr.send(formData);
  });
}

export async function generateVideo(
  matchId: string,
  format: string,
  highlightRanks: number[],
  mood: Mood = "acao",
  playerName?: string,
  orientation: Orientation = "vertical"
): Promise<GenerateResponse> {
  const res = await fetch(`${BASE}/matches/${matchId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      format,
      highlight_ranks: highlightRanks,
      mood,
      player_name: playerName,
      orientation,
    }),
  });
  if (!res.ok) throw new Error("Failed to generate video");
  return res.json();
}
