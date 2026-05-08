"use client";

import { useEffect, useState } from "react";

/**
 * Steam GC status (Sprint DEMO-3) — pollado do client local 127.0.0.1:5775.
 *
 * Combina informação de:
 *   - Sidecar tá rodando? (DEMO-3 disponível?)
 *   - Tem refresh_token salvo? (auto-login funciona?)
 *   - GC connection ativa? (pode puxar matches?)
 *   - Tem match_sharing_auth_code? (paginação completa funciona?)
 *
 * 4 estados derivados pra UI:
 *   - "client_offline" — client desktop não tá rodando (precisa baixar/abrir)
 *   - "needs_credentials" — client OK mas user precisa fazer primeiro login Steam
 *   - "needs_auth_code" — credentials OK mas falta match_sharing_auth_code (1x setup)
 *   - "ready" — tudo OK, pode chamar /api/steam/match-history
 */
export type SteamGCUIState =
  | "checking"
  | "client_offline"
  | "needs_credentials"
  | "needs_auth_code"
  | "ready";

export interface SteamGCStatus {
  state: SteamGCUIState;
  /** Sidecar disponível (.exe novo o suficiente pra ter DEMO-3 features). */
  available: boolean;
  /** Sidecar Node child process ativo. */
  running: boolean;
  /** Steam logged in via credentials (não OAuth web). */
  loggedIn: boolean;
  /** GC connected — pode puxar match data. */
  gcConnected: boolean;
  /** Tem refresh_token cacheado. */
  hasSavedToken: boolean;
  /** Tem match_sharing_auth_code salvo. */
  hasAuthCode: boolean;
  /** SteamID64 do login (do refresh_token salvo). */
  steamid64: string | null;
  /** Last error message (se algo falhou). */
  error: string | null;
}

const ENDPOINT = "http://127.0.0.1:5775/api/steam/status";

const INITIAL: SteamGCStatus = {
  state: "checking",
  available: false,
  running: false,
  loggedIn: false,
  gcConnected: false,
  hasSavedToken: false,
  hasAuthCode: false,
  steamid64: null,
  error: null,
};

export function useSteamGCStatus(intervalMs = 5000): SteamGCStatus {
  const [status, setStatus] = useState<SteamGCStatus>(INITIAL);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(ENDPOINT, {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timer);
        if (!alive) return;

        if (!res.ok && res.status !== 503) {
          // Endpoint exists but errored — server alive but GC issue
          setStatus((prev) => ({
            ...prev,
            state: "needs_credentials",
            available: true,
            running: false,
            error: `HTTP ${res.status}`,
          }));
          return;
        }

        const data = await res.json();
        if (!alive) return;

        const available: boolean = !!data.available;
        const running: boolean = !!data.running;
        const loggedIn: boolean = data.login_state === "logged-in";
        const gcConnected: boolean = !!data.gc_connected;
        const hasSavedToken: boolean = !!data.has_saved_token;
        const hasAuthCode: boolean = !!data.has_match_sharing_code;
        const steamid64: string | null = data.saved_steamid64 || data.steamid || null;

        // State machine derivation
        let state: SteamGCUIState;
        if (!available || !running) {
          state = "client_offline";
        } else if (!loggedIn || !gcConnected) {
          state = "needs_credentials";
        } else if (!hasAuthCode) {
          state = "needs_auth_code";
        } else {
          state = "ready";
        }

        setStatus({
          state,
          available,
          running,
          loggedIn,
          gcConnected,
          hasSavedToken,
          hasAuthCode,
          steamid64,
          error: data.error || null,
        });
      } catch (err) {
        // Fetch failed — client offline (port 5775 closed OR endpoint não existe)
        if (!alive) return;
        setStatus((prev) => ({
          ...prev,
          state: "client_offline",
          available: false,
          running: false,
          error: null,
        }));
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs]);

  return status;
}
