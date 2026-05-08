/**
 * Steam Auth Code + Sharecode anchor — client-side storage.
 *
 * Sprint DEMO-3 v3 (2026-05-08): Pivot de bot 24/7 → Steam Web API
 * `GetNextMatchSharingCode`. Setup pede 2 strings 1 vez:
 *   1. authCode  — chave pessoal (vem de steamcommunity.com/.../matchToken)
 *   2. anchorSharecode — sharecode âncora (vem do CS2 Watch tab)
 *
 * A partir daí, a Vercel function `/api/steam/walker` chama
 * GetNextMatchSharingCode em loop pra descobrir matches novos.
 *
 * Storage: localStorage por enquanto (MVP). Auth code é semi-sensível mas
 * NÃO é credencial completa — só permite ler match history pública desse
 * user específico. Allstar/Leetify/cs-demo-manager seguem mesmo padrão.
 *
 * Future: migrar pra cookie httpOnly server-side quando tiver DB.
 */

const KEY_AUTH_CODE = "fragreel_steam_auth_code";
const KEY_ANCHOR = "fragreel_steam_anchor_sharecode";
const KEY_LAST_KNOWN = "fragreel_steam_last_known_sharecode";

export interface SteamAuthSetup {
  authCode: string;
  anchorSharecode: string;
}

export function getSteamAuthSetup(): SteamAuthSetup | null {
  if (typeof window === "undefined") return null;
  const authCode = localStorage.getItem(KEY_AUTH_CODE);
  const anchor = localStorage.getItem(KEY_ANCHOR);
  if (!authCode || !anchor) return null;
  return { authCode, anchorSharecode: anchor };
}

export function setSteamAuthSetup(setup: SteamAuthSetup): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_AUTH_CODE, setup.authCode);
  localStorage.setItem(KEY_ANCHOR, setup.anchorSharecode);
  localStorage.setItem(KEY_LAST_KNOWN, setup.anchorSharecode);
}

export function clearSteamAuthSetup(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_AUTH_CODE);
  localStorage.removeItem(KEY_ANCHOR);
  localStorage.removeItem(KEY_LAST_KNOWN);
}

/** Último sharecode conhecido pelo walker — atualizado a cada walk bem-sucedido. */
export function getLastKnownSharecode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_LAST_KNOWN);
}

export function setLastKnownSharecode(code: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_LAST_KNOWN, code);
}

// ── Validation helpers ─────────────────────────────────────────────────────

const AUTH_CODE_PATTERN = /^[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}$/i;
const SHARECODE_PATTERN = /^CSGO(-[A-Z0-9]{5}){5}$/i;

export function isValidAuthCode(code: string): boolean {
  return AUTH_CODE_PATTERN.test(code.trim());
}

export function isValidSharecode(code: string): boolean {
  return SHARECODE_PATTERN.test(code.trim());
}
