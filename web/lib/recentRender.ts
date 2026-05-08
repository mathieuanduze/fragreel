/**
 * Recent Render — last reel rendered, 1h TTL.
 *
 * Sprint DEMO-3 v5 (08/05/2026 Mathieu spec): "vamos armazenar por
 * 1h o último reel gerado". Sidebar mostra item "Renders Recentes"
 * apenas quando há registro < 1h. Click → mostra path do MP4 +
 * botão "Abrir" (que chama 127.0.0.1:5775/render/open).
 *
 * Storage: localStorage. Sem servidor envolvido — render é local.
 */

const KEY = "fragreel_recent_render";
const TTL_MS = 60 * 60 * 1000; // 1h

export interface RecentRender {
  matchId: string;
  mapName: string;
  mp4Path: string;
  renderedAt: number; // epoch ms
}

export function setRecentRender(r: Omit<RecentRender, "renderedAt">): void {
  if (typeof window === "undefined") return;
  const payload: RecentRender = { ...r, renderedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota cheio? localStorage offline? Silent fail — render
    // sucedeu de qualquer jeito, perda do quick-link é minor.
  }
}

export function getRecentRender(): RecentRender | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RecentRender;
    if (!r.renderedAt || Date.now() - r.renderedAt > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

export function clearRecentRender(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

/** Tempo restante do TTL em minutos, pra UI mostrar "expira em Xmin". */
export function getRecentRenderTTLMinutes(r: RecentRender): number {
  const elapsedMs = Date.now() - r.renderedAt;
  const remainingMs = TTL_MS - elapsedMs;
  return Math.max(0, Math.floor(remainingMs / 60000));
}
