/**
 * Client-side session management.
 * Token is stored in localStorage and sent as Authorization: Bearer <token>.
 */

const TOKEN_KEY = "fragreel_token";

export interface SessionUser {
  steamid: string;
  name: string;
  avatar: string;
}

// ── Storage ────────────────────────────────────────────────────────────────────

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

// ── JWT decode (no verification — server does that) ───────────────────────────

export function getUser(): SessionUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return {
      steamid: payload.steamid ?? "",
      name:    payload.name    ?? "Player",
      avatar:  payload.avatar  ?? "",
    };
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getUser() !== null;
}

export function logout(): void {
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ── Auth header for fetch calls ────────────────────────────────────────────────

export function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
