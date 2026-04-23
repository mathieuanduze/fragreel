/**
 * Cliente HTTP para os endpoints /config do FragReel client (v0.2.7+).
 *
 * Permite ao web ver/editar a pasta de saída onde o .mov / .mp4 final é
 * salvo. Útil quando o disco do CS2 está cheio e o usuário quer apontar
 * pra outro drive (D:\, E:\…).
 *
 * Importante: redireciona apenas o output FINAL. Os TGAs intermediários
 * continuam em <CS2>/game/bin/win64/fragreel/ porque o HLAE escreve lá
 * direto (limitação do `mirv_streams record name`). Pra mover a captura
 * intermediária precisa Steam library transfer ou junction point.
 */

import { LOCAL_BASE, LocalClientOffline } from "./local";

export type ConfigSource = "env" | "config" | "default";

export interface ResolvedConfig {
  /** Effective output_dir (after applying precedence chain). */
  output_dir: string;
  /** Where the value came from — UI shows a banner when source="env"
   *  ("FRAGREEL_OUTPUT_DIR está sobrescrevendo a UI"). */
  source: ConfigSource;
  /** Built-in default (~/Desktop/FragReel) — UI shows it as the
   *  placeholder/reset target. */
  default: string;
  /** Set when FRAGREEL_OUTPUT_DIR is present, even if source !== "env"
   *  (forward compat — currently env always wins). */
  env_override: string | null;
}

export interface PickFolderResult {
  cancelled: boolean;
  path?: string;
}

async function fetchConfig<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${LOCAL_BASE}${path}`, init);
  } catch {
    throw new LocalClientOffline();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    const err = new Error(
      body?.detail || body?.error || `local_api ${res.status}`,
    ) as Error & { code?: string; status: number };
    err.code = body?.error;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

/** Fetch current effective output_dir + provenance. */
export async function getConfig(): Promise<ResolvedConfig> {
  return fetchConfig<ResolvedConfig>("/config");
}

/** Persist a new output_dir. Returns the freshly-resolved value (which
 *  may differ from the requested path if the env var still wins). */
export async function setConfig(outputDir: string): Promise<ResolvedConfig> {
  return fetchConfig<ResolvedConfig>("/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ output_dir: outputDir }),
  });
}

/** Reset to default (clears the override in config.json). */
export async function resetConfig(): Promise<ResolvedConfig> {
  return fetchConfig<ResolvedConfig>("/config/reset", { method: "POST" });
}

/** Open the OS-native folder picker on the user's PC and return the
 *  chosen path. Returns `{cancelled: true}` if the user closed the
 *  dialog without picking. The caller still needs to call setConfig()
 *  to persist. Throws if tkinter isn't bundled (501). */
export async function pickFolder(): Promise<PickFolderResult> {
  return fetchConfig<PickFolderResult>("/config/pick-folder", {
    method: "POST",
  });
}
