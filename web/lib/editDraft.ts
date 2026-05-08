/**
 * Edit Draft — sessão ativa de edição de FragReel.
 *
 * Mathieu spec literal (Sprint v5.3, 08/05/2026):
 *   "Quando eu tô em /match, eu ainda preciso da sidebar pra navegar.
 *    Precisa ter uma das etapas com 'editar fragreel quando um fragreel
 *    tá sendo editado, salva esse status de edição"
 *
 * Lifecycle:
 *   1. User entra em /match/[id] → setEditDraft({ matchId, mapName, ... })
 *   2. AppShell sidebar renderiza item "Editando: [Map]" laranja pulsante
 *   3. Click no sidebar item → navega de volta pra /match/[matchId]
 *   4. User altera selections (cenas, mood, toggles) → setEditDraft atualiza
 *   5. User clica "Gerar FragReel" + render success → clearEditDraft +
 *      setRecentRender (move pra "Meus FragReels")
 *   6. User pode descartar edição manualmente via X no sidebar item
 *
 * Storage: localStorage (sem TTL — draft persiste até user gerar ou
 * descartar). Diferente do RecentRender (TTL 1h).
 *
 * Schema overlap intencional com FragReelSpec — ao gerar reel, o draft
 * vira RecentRender (mesmos campos + mp4Path).
 */

const KEY = "fragreel_edit_draft";

export interface EditDraft {
  matchId: string;
  mapName: string;
  playerName?: string;
  playerSteamid?: string;
  // Snapshot das selections atuais — pode estar incompleto se user
  // ainda não escolheu mood/etc.
  selectedHighlightIds?: string[];
  mood?: string;
  orientation?: "vertical" | "horizontal";
  toggles?: {
    cinematic?: boolean;
    hud?: boolean;
    xray?: boolean;
    music?: boolean;
    bombTimer?: boolean;
  };
  musicTrack?: string;
  /** Epoch ms — quando entrou em /match (pra mostrar "editando há Xmin"). */
  startedAt: number;
  /** Epoch ms — última atualização (qualquer mudança no draft). */
  updatedAt: number;
}

export function setEditDraft(
  draft: Omit<EditDraft, "startedAt" | "updatedAt">,
): void {
  if (typeof window === "undefined") return;
  const existing = getEditDraft();
  // Se já tem draft do mesmo match, preserva startedAt (data de início).
  // Se mudou de match, reset startedAt.
  const startedAt =
    existing && existing.matchId === draft.matchId
      ? existing.startedAt
      : Date.now();
  const payload: EditDraft = {
    ...draft,
    startedAt,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    // Notifica outros tabs / AppShell sidebar pra re-renderizar
    window.dispatchEvent(new Event("editDraft:change"));
  } catch {
    // Silent fail — quota / disabled storage
  }
}

export function getEditDraft(): EditDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EditDraft;
  } catch {
    return null;
  }
}

export function clearEditDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("editDraft:change"));
}

/** "Editando há 3min" / "Editando há 12min" — formato leve pro sidebar. */
export function editingForMinutes(d: EditDraft): number {
  return Math.max(0, Math.floor((Date.now() - d.startedAt) / 60000));
}
