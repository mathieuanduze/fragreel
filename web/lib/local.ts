/**
 * Cliente HTTP para o local_api do FragReel Client (127.0.0.1:5775).
 *
 * O client desktop expõe esses endpoints quando está rodando no PC do user.
 * Se o fetch falhar (ECONNREFUSED), o client está fechado — a UI mostra um
 * estado "instale/abra o FragReel".
 */

import type { MatchOut } from "./api";

export const LOCAL_BASE = "http://127.0.0.1:5775";

export interface LocalDemo {
  demo_path: string;
  sha1: string;
  mtime: number;
  map_name: string;
  score_ct: number;
  score_t: number;
  player_kills: number;
  player_deaths: number;
  size_mb: number;
  /** Quando preenchido, demo já foi analisada pelo server e tem highlights
   *  extraídos em /match/{id}. NOTA: NÃO significa que tem reel renderizado —
   *  pivot v0.2.x pro modelo on-demand removeu o conceito de "FragReel pronto".
   *  Todo reel é renderizado localmente sob demanda. */
  match_id?: string | null;
  /** Epoch (s) do upload bem-sucedido. */
  processed_at?: number | null;
}

export interface LocalDemosResponse {
  matches: LocalDemo[];
  scanning: boolean;
  scan_done: boolean;
  error: string | null;
}

export interface LocalJob {
  event: "queued" | "uploading" | "done" | "skipped" | "failed";
  sha?: string;
  path?: string;
  position?: number;
  attempt?: number;
  match_id?: string;
  highlights?: number;
  duration_s?: number;
  reason?: string;
  error?: string;
  /**
   * True when the local client short-circuited a re-analyze because the demo
   * was already uploaded before (scanner cache hit). In this case `event`
   * goes straight to `done`, `duration_s` is 0, and `highlights` reflects
   * whatever was cached at upload time (may be 0 for legacy entries from
   * clients older than v0.2.15). The UI should use this flag to avoid
   * showing "0 highlights detectados" as if the analysis produced nothing.
   */
  cache_hit?: boolean;
}

export class LocalClientOffline extends Error {
  constructor() {
    super("FragReel client não está rodando em 127.0.0.1:5775");
    this.name = "LocalClientOffline";
  }
}

// Chrome 120+ enforces Private Network Access (PNA): HTTPS pages need
// opt-in to hit HTTP 127.0.0.1. Negotiation happens server-side — the
// client_api emits `Access-Control-Allow-Private-Network: true` from
// v0.2.13's WSGI middleware. Chrome 147 probing showed that adding
// `targetAddressSpace: "private"` to the fetch options causes a
// "TypeError: Failed to fetch" even though the server advertises the
// capability correctly. Path of least resistance: trust the server-side
// header alone, leave the fetch init unchanged.
//
// If a future Chrome enforces the client-side opt-in too, we add
// `targetAddressSpace` back here in ONE place without touching the call
// sites. Keeping this wrapper is forward-compatibility insurance.
function privateFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

async function fetchLocal<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await privateFetch(`${LOCAL_BASE}${path}`, init);
  } catch {
    throw new LocalClientOffline();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`local_api ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function pingLocalClient(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await privateFetch(`${LOCAL_BASE}/health`, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Retorna a versão reportada pelo client local — ou null se offline / sem suporte. */
export async function getLocalClientVersion(timeoutMs = 1500): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await privateFetch(`${LOCAL_BASE}/version`, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as { version?: string } | null;
    return data?.version ?? null;
  } catch {
    return null;
  }
}

export async function getLocalDemos(refresh = false): Promise<LocalDemosResponse> {
  return fetchLocal<LocalDemosResponse>(`/demos${refresh ? "?refresh=1" : ""}`);
}

export async function triggerLocalUpload(sha: string): Promise<LocalJob> {
  return fetchLocal<LocalJob>(`/demos/${sha}/upload`, { method: "POST" });
}

export async function getLocalJob(sha: string): Promise<LocalJob | null> {
  try {
    return await fetchLocal<LocalJob>(`/jobs/${sha}`);
  } catch (e) {
    if (e instanceof LocalClientOffline) throw e;
    return null;
  }
}

// ── Render (HLAE capture pipeline on the user's PC) ───────────────────────

export interface RenderSegment {
  start_tick: number;
  end_tick: number;

  // v0.3.0-alpha — opcionais. Server expõe em `HighlightOut`; web repassa pro
  // client que aplica `cluster_round_kills()` em `capture_script.py` pra
  // capturar só os trechos com ação dentro do round. Client v0.2.x ignora —
  // fallback gracioso pra round window completo.
  kill_ticks?: number[];
  kill_timestamps?: number[];

  // v0.3.0-beta-2 — scenario context pro client decidir pads/buffers extras:
  //   • clutch_situation → pad_pre += 3s flat (POV, não escala com N)
  //   • is_round_winning_kill → pad_post += 3s
  //   • bomb_action + bomb_action_tick → garante captura inteira da animação
  //     (plant 3.2s ou defuse 10s no-kit). Cliente back-calcula start tick.
  //   Algoritmo cluster_round_kills_v2 spec em [[v0.3 Cluster Tuning Research]].
  clutch_situation?: "1v1" | "1v2" | "1v3" | "1v4" | "1v5" | null;
  is_round_winning_kill?: boolean;
  bomb_action?: "defuse" | "plant_won" | null;
  bomb_action_tick?: number | null;
}

export interface LocalRenderPlan {
  demo_path: string;
  segments: RenderSegment[];
  user_steamid64?: string;
  /** Display name in CS2 scoreboard. Required for `spec_player "<name>"` —
   *  CS2 (Source 2) has no `spec_player_by_accountid`, so without this the
   *  capture script falls back to free-cam and the camera stays static at
   *  the spawn point. v0.2.6+ wires this through end-to-end. */
  user_player_name?: string;
  /** Round 4c Fase 1.6 — full ReelProps payload pro Remotion compositor.
   *  Mirror exato de api/models.py RenderPlanRequest props (computed em
   *  routes/matches.py /render-plan endpoint). Sem isso, hlae_runner passa
   *  base_props={} pro Remotion → composition cai em defaultProps
   *  (MOCK_REEL_PROPS = Dust2/mathieu mock) → MP4 vem com dados errados
   *  apesar do pipeline rodar OK.
   *  PC test 26/04 catched: pipeline PASS mas conteúdo FAIL (Dust2 vs Inferno
   *  real, mock player name vs ZE_CHAMINE.GiF, mock rounds R14/R22/R7 vs
   *  payload pediu R7/R8/R14, etc).
   *  Schema deve bater com editor/src/types.ts ReelProps. */
  reel_props?: {
    match: MatchOut;
    selectedRanks: number[];
    mood: "eletronica" | "acao" | "heroico" | "chill";
    playerName: string;
    orientation?: "vertical" | "horizontal";
  };
  record_name?: string;
  stream_name?: string;
  /** Force-terminate a running CS2 instance. Default false (we refuse). */
  force?: boolean;
  /** Optional client-side id the web can use to correlate sessions. */
  render_id?: string;
}

export type LocalRenderState =
  | "idle"
  | "staging"
  | "launching"
  | "capturing"
  | "converting"
  | "rendering"
  | "done"
  | "error"
  | "cancelled";

export interface LocalRenderSession {
  render_id: string;
  state: LocalRenderState;
  stage: string;
  progress: number; // 0..1
  frames_captured: number;
  frames_expected: number;
  // Per-segment ProRes outputs (one .mov per highlight). Round 4d shape;
  // earlier clients (<= v0.1.10) emit `output_mov: string | null` instead.
  segments_total?: number;
  segments_done?: number;
  output_movs?: string[];
  output_mov?: string | null; // legacy fallback (single .mov pre-multitake)
  output_mp4: string | null;
  error: string | null;
  started_at: number | null;
  finished_at: number | null;
}

export interface RenderPreflight {
  ready: boolean;
  reason?: "cs2_running" | "render_in_progress" | "render_not_configured";
  cs2_pids?: number[];
  render_id?: string;
}

/** Cheap "can I render right now?" check. Call BEFORE opening the ad modal
 *  so we don't waste the user's ad-watch if CS2 is live or a render is
 *  already running. Returns `{ready:true}` when the pipeline is free. */
export async function renderPreflight(): Promise<RenderPreflight> {
  try {
    return await fetchLocal<RenderPreflight>(`/render/preflight`);
  } catch (e) {
    if (e instanceof LocalClientOffline) throw e;
    return { ready: false, reason: "render_not_configured" };
  }
}

export interface DiskIssue {
  drive: string;
  needed_gb: number;
  free_gb: number;
  /** Backend marker of what stage needed the space (e.g. "tga_capture",
   *  "ffmpeg_convert"). Used by the UI to phrase the message. */
  kind: string;
}

/** Kick off the capture pipeline on the user's PC. Returns the initial
 *  session; the web should then poll `getLocalRenderStatus()` to show
 *  progress while the user watches ads.
 *
 *  Throws typed errors that the UI can branch on:
 *    • `LocalClientOffline` — client process not running on 127.0.0.1
 *    • `Error & { code: "cs2_running", cs2_pids }` — 409
 *    • `Error & { code: "insufficient_disk", issues }` — 507
 *    • generic `Error` — unexpected backend failure
 */
export async function startLocalRender(plan: LocalRenderPlan): Promise<LocalRenderSession> {
  const res = await privateFetch(`${LOCAL_BASE}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  }).catch(() => {
    throw new LocalClientOffline();
  });
  if (res.status === 409) {
    // CS2 busy — surface a typed error so the UI can show "close CS2" UX.
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.detail || "CS2 running") as Error & {
      code: string;
      cs2_pids?: number[];
    };
    err.code = body.error || "cs2_running";
    err.cs2_pids = body.cs2_pids;
    throw err;
  }
  if (res.status === 507) {
    // Disk preflight failed — typed error carrying the per-drive breakdown
    // so the UI can show "libere X GB no drive Y" em vez de erro genérico.
    // Caía no fallback "server-side render" silencioso pré-fix, que abria
    // o AdModal prometendo um download que nunca ia chegar (server não
    // tem Remotion ainda — render é 100% local).
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.detail || "insufficient disk space") as Error & {
      code: string;
      issues?: DiskIssue[];
    };
    err.code = body.error || "insufficient_disk";
    err.issues = body.issues;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`local_api ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/** Poll target. Returns `state: "idle"` if no render has ever run. */
export async function getLocalRenderStatus(): Promise<LocalRenderSession | { state: "idle" }> {
  return fetchLocal<LocalRenderSession | { state: "idle" }>(`/render/status`);
}

/** Abort the current render and kill CS2. Called from the X button on AdModal. */
export async function cancelLocalRender(): Promise<LocalRenderSession | { state: "idle" }> {
  return fetchLocal<LocalRenderSession | { state: "idle" }>(`/render/cancel`, {
    method: "POST",
  });
}

export interface OpenOutputResult {
  opened: boolean;
  /** What we asked the OS to open. Surfaced in the UI as a fallback chip
   *  the user can copy if the open failed. */
  path: string | null;
  /** "file" = opened the rendered video itself (preferred).
   *  "folder" = opened the parent folder (fallback when no file is ready).
   *  null when nothing was opened. */
  kind: "file" | "folder" | null;
  reason?: string;
}

/** Ask the local client to open the rendered output in the default OS app
 *  (Windows: os.startfile). Falls back to opening the parent folder if no
 *  file is available. Older clients (<= v0.2.8) don't expose this endpoint;
 *  the caller should catch the resulting 404 and degrade to the path-copy
 *  chip instead. */
export async function openLocalRenderOutput(): Promise<OpenOutputResult> {
  return fetchLocal<OpenOutputResult>(`/render/open`, { method: "POST" });
}

// ── Auto-update (v0.2.11+) ────────────────────────────────────────────

export interface ClientUpdateResult {
  started: boolean;
  new_exe: string;
  current_exe: string;
  pid: number;
  size_mb: number;
  message: string;
}

/** Tell the local client to download the latest .exe and swap+relaunch
 *  itself. Returns once the download finished and the swap helper has
 *  been spawned — the actual exit happens ~2s later, then the new client
 *  comes back online in another ~3-10s.
 *
 *  Caller is expected to:
 *    1. Show "baixando…" while this promise is pending
 *    2. Switch to "esperando reiniciar…" once it resolves
 *    3. Poll `useClientVersionStatus` (which polls /version every 8s)
 *       and close the modal when status flips to "current"
 *
 *  Errors:
 *    • LocalClientOffline — client process not running
 *    • Error("not_frozen ...") — running from `python main.py` in dev,
 *      not the .exe; user must update manually
 *    • Error("download_failed ...") — network/server issue, surface to user
 *    • Error("download_too_small ...") — got HTML instead of .exe (404?)
 */
export async function triggerClientUpdate(): Promise<ClientUpdateResult> {
  let res: Response;
  try {
    res = await privateFetch(`${LOCAL_BASE}/update`, { method: "POST" });
  } catch {
    throw new LocalClientOffline();
  }
  // 501 from older clients (<= v0.2.10) means /update doesn't exist OR
  // the user is on a non-frozen / non-Windows build — either way, manual
  // update is the only path. Surface a typed error so the modal can fall
  // back to the manual download CTA cleanly.
  if (res.status === 501) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(
      body.detail || "auto-update não suportado neste client",
    ) as Error & { code: string };
    err.code = body.error || "not_supported";
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(
      body.detail || `update failed (${res.status})`,
    ) as Error & { code: string };
    err.code = body.error || "update_failed";
    throw err;
  }
  return res.json();
}
