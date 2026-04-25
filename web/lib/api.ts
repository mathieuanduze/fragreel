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

// Situações de clutch detectadas server-side em v0.3.0-alpha (outcome-based:
// user fica 1vN no meio do round E ganha o round → marca como clutch N).
export type ClutchSituation = "1v1" | "1v2" | "1v3" | "1v4" | "1v5";

// Ação da bomba atribuída ao user no round (v0.3.0-alpha).
// - "defuse": user defusou o C4 no round (CT side)
// - "plant_won": user plantou e o time ganhou (por defender até explodir OU
//                por aces / map control pós-plant)
export type BombAction = "defuse" | "plant_won";

export interface HighlightOut {
  rank: number;
  round_num: number;
  label: string;
  // v0.3.1 (A4): resumo PT-BR ao lado das tags. Tags continuam em inglês
  // pra internacionalização; narrative descreve em prosa o que aconteceu
  // pra usuários casuais sem decorar jargão. Null em demos legacy.
  narrative?: string | null;
  score: number;
  start: number;
  end: number;
  kills: KillOut[];
  clip_url?: string | null;

  // Campos v0.3.0-alpha — opcionais pra compatibilidade com demos antigas
  // parseadas por versões anteriores do scorer (retornam undefined).
  // Web usa pra renderizar badges contextuais nos cards de highlight; client
  // usa `kill_ticks` / `kill_timestamps` pra clusterizar a captura em sub-
  // janelas (`capture_script.py` v0.3.0-beta, algoritmo em `v0.3 Plano
  // Produto` §2 linhas 164-189).
  clutch_situation?: ClutchSituation | null;
  won_round?: boolean;
  bomb_action?: BombAction | null;
  is_round_winning_kill?: boolean;
  kill_ticks?: number[];        // ticks (exatos) de cada kill do user no round
  kill_timestamps?: number[];   // mesmas kills em segundos do jogo (tick / tickrate)

  // v0.3.0-beta-2 — bomb action completion tick (NÃO é o tick de início da
  // animação; é quando a bomba foi armada/desarmada). Cliente back-calcula
  // a janela de animação com PLANT_ANIM=3.2s ou DEFUSE_ANIM_NOKIT=10s
  // pra garantir cobertura inteira do evento (regra dura "defuse + plant
  // inteiros"). Null em highlights legados.
  bomb_action_tick?: number | null;
  bomb_action_timestamp?: number | null;
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
  // v0.3.0-beta-3 (Bug #11 fix): in-game name extraído do parser do server.
  // Web prefere isso ao Steam display name pra evitar mismatch que faz
  // capture_script cair em free-cam autodirector. Null em demos antigas
  // parseadas pré-v0.3.0-beta-3.
  player_name?: string | null;
}

// v0.2.16: `MatchSummary` + `getMatches()` removidos com a descontinuação
// do /dashboard (B1 do redesign UX). Esse endpoint listava o histórico de
// FragReels gerados — não tem mais superfície de UI que use. Se voltar a
// fazer sentido expor essa lista, reintroduzir aqui ao invés de chamar o
// backend direto de outro lugar.

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

export interface HighlightPlan {
  rank: number;
  label: string;
  duration_sec: number;
}

export interface RenderPlan {
  format: string;
  orientation: Orientation;
  intro_sec: number;
  timeline_sec: number;
  outro_sec: number;
  highlights: HighlightPlan[];
  total_sec: number;
  width: number;
  height: number;
}

// Preview de duração antes do user assistir o ad.
// Espelha exatamente o cálculo do editor — se divergir, o user é surpreendido.
export async function getRenderPlan(
  matchId: string,
  format: string,
  highlightRanks: number[],
  orientation: Orientation = "vertical"
): Promise<RenderPlan> {
  const res = await fetch(`${BASE}/matches/${matchId}/render-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      format,
      highlight_ranks: highlightRanks,
      orientation,
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch render plan");
  return res.json();
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
