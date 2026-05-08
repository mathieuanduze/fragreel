/**
 * Meus FragReels — histórico de reels gerados, com specs completas
 * pra "Gerar novamente" (Sprint v5.2, 08/05/2026).
 *
 * Mathieu spec literal:
 *   "Você não criou a seção meus fragreels onde guardamos o histórico
 *    do gerado e podemos guardar as specs do que foi gerado (plays
 *    selecionadas, música selecionada, toggles, etc). Aí o CTA é
 *    gerar fragreel novamente, onde ele vai pra página /match"
 *
 * Storage: localStorage por enquanto (MVP zero-infra). TTL 1h por
 * entry — Mathieu disse "armazenar por 1h o último reel gerado". Quando
 * houver server-side persistence (próxima sessão), migrar pra
 * /api/fragreels endpoints com user-scoped storage.
 *
 * Schema da spec — captura tudo necessário pra reproduzir o reel:
 *   - matchId + mapName (referência cross)
 *   - playerName (quem é o protagonista)
 *   - selectedHighlightIds (cenas escolhidas)
 *   - mood (heroico/intenso/épico/calmo)
 *   - orientation (vertical/horizontal)
 *   - toggles (cinematic, hud, xray, music, bombTimer)
 *   - musicTrack (qual trilha do mood)
 *   - mp4Path (output local pra "Abrir vídeo")
 *   - renderedAt (epoch ms)
 *
 * Histórico antigo (v5.0): só guardava { matchId, mapName, mp4Path,
 * renderedAt }. Mantido o KEY pra graceful migration — entries antigas
 * sem specs ainda funcionam pra "Abrir vídeo", só não tem "Gerar
 * novamente" disponível.
 */

const KEY = "fragreel_recent_render";
const TTL_MS = 60 * 60 * 1000; // 1h

export interface FragReelToggles {
  cinematic?: boolean;
  hud?: boolean;
  xray?: boolean;
  music?: boolean;
  bombTimer?: boolean;
}

export interface FragReelSpec {
  /** Referência ao match. Permite "Gerar novamente" → /match/[id]. */
  matchId: string;
  mapName: string;
  /** Nome do player protagonista (display). */
  playerName?: string;
  /** Steam ID do player (pra re-fetch match com mesma perspectiva). */
  playerSteamid?: string;
  /** IDs/indexes dos highlights selecionados pro reel. */
  selectedHighlightIds?: string[];
  mood?: string;
  orientation?: "vertical" | "horizontal";
  toggles?: FragReelToggles;
  musicTrack?: string;
  /** Path do MP4 final no PC do user (pra "Abrir vídeo"). */
  mp4Path: string;
  /** Epoch ms quando render concluiu. */
  renderedAt: number;
}

/** Backwards-compat alias pra v5.0 — usado por /renders page legacy. */
export type RecentRender = FragReelSpec;

export function setRecentRender(spec: Omit<FragReelSpec, "renderedAt">): void {
  if (typeof window === "undefined") return;
  const payload: FragReelSpec = { ...spec, renderedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota cheio? localStorage offline? Silent fail — render
    // sucedeu de qualquer jeito, perda do quick-link é minor.
  }
}

export function getRecentRender(): FragReelSpec | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as FragReelSpec;
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
export function getRecentRenderTTLMinutes(r: FragReelSpec): number {
  const elapsedMs = Date.now() - r.renderedAt;
  const remainingMs = TTL_MS - elapsedMs;
  return Math.max(0, Math.floor(remainingMs / 60000));
}

/** Helper pra UI mostrar resumo das specs ("3 cenas · Mood Heroico · Vertical"). */
export function specsSummary(r: FragReelSpec): string {
  const parts: string[] = [];
  if (r.selectedHighlightIds?.length) {
    parts.push(`${r.selectedHighlightIds.length} cenas`);
  }
  if (r.mood) parts.push(`Mood ${r.mood}`);
  if (r.orientation) {
    parts.push(r.orientation === "vertical" ? "Vertical" : "Horizontal");
  }
  return parts.join(" · ") || "Reel gerado";
}
