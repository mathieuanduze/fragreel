/**
 * Cliente HTTP para o local_api do FragReel Client (127.0.0.1:5775).
 *
 * O client desktop expõe esses endpoints quando está rodando no PC do user.
 * Se o fetch falhar (ECONNREFUSED), o client está fechado — a UI mostra um
 * estado "instale/abra o FragReel".
 */

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
  /** Quando preenchido, demo já foi enviada e tem FragReel pronto em /match/{id}. */
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
}

export class LocalClientOffline extends Error {
  constructor() {
    super("FragReel client não está rodando em 127.0.0.1:5775");
    this.name = "LocalClientOffline";
  }
}

async function fetchLocal<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${LOCAL_BASE}${path}`, init);
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
    const res = await fetch(`${LOCAL_BASE}/health`, { signal: ctl.signal, cache: "no-store" });
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
    const res = await fetch(`${LOCAL_BASE}/version`, { signal: ctl.signal, cache: "no-store" });
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
