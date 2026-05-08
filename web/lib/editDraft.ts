/**
 * Edit Drafts — múltiplas sessões ativas de edição (Sprint v5.5).
 *
 * Mathieu spec evoluiu (08/05/2026):
 *   v5.3: "Precisa ter etapa de editar fragreel quando um fragreel tá
 *          sendo editado, salva esse status de edição"
 *   v5.5: "Acho que o usuário poderia deixar até 3 edições simultâneas"
 *
 * Lifecycle:
 *   1. User entra em /match/[id] → setEditDraft({ matchId, ... })
 *      - Se já existe draft pro mesmo matchId, ATUALIZA (preserva startedAt)
 *      - Se é matchId novo, ADICIONA (até 3)
 *      - Se já tem 3 e é match novo, DESCARTA o mais antigo (oldest updatedAt)
 *   2. AppShell sidebar renderiza N items (1-3) "Editando: <Map>"
 *   3. User pode descartar individual via X em cada item
 *   4. Render success → clearEditDraft(matchId) automático (TODO: AdModal hook)
 *
 * Storage: localStorage key fragreel_edit_drafts (plural). Migration
 * automática do schema antigo (single object) é implícita: getEditDrafts
 * lê o key novo, retorna [] se não existe. Schema antigo
 * (fragreel_edit_draft singular) será limpo quando user clicar X em
 * legacy item ou via TTL de 24h.
 *
 * Notify: dispatchEvent("editDraft:change") em qualquer mutação pra
 * AppShell sidebar re-renderizar imediato.
 */

const KEY = "fragreel_edit_drafts";
const KEY_LEGACY = "fragreel_edit_draft"; // schema v5.3 single — migration soft
const MAX_DRAFTS = 3;

export interface EditDraft {
  matchId: string;
  mapName: string;
  playerName?: string;
  playerSteamid?: string;
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
  startedAt: number;
  updatedAt: number;
}

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("editDraft:change"));
}

function readDrafts(): EditDraft[] {
  if (typeof window === "undefined") return [];
  try {
    // Schema v5.5: array.
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as EditDraft[];
    }
    // Migration soft: schema antigo v5.3 (single object) → vira array.
    const legacy = localStorage.getItem(KEY_LEGACY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as EditDraft;
      if (parsed && parsed.matchId) {
        const migrated = [parsed];
        localStorage.setItem(KEY, JSON.stringify(migrated));
        localStorage.removeItem(KEY_LEGACY);
        return migrated;
      }
    }
    return [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: EditDraft[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(drafts));
    notifyChange();
  } catch {
    // Silent fail
  }
}

/**
 * Set/update um draft específico. Se matchId já existe, ATUALIZA preservando
 * startedAt. Se é novo e já há MAX_DRAFTS, descarta o mais antigo (menor
 * updatedAt).
 */
export function setEditDraft(
  draft: Omit<EditDraft, "startedAt" | "updatedAt">,
): void {
  if (typeof window === "undefined") return;
  const all = readDrafts();
  const existingIdx = all.findIndex((d) => d.matchId === draft.matchId);
  const now = Date.now();

  if (existingIdx >= 0) {
    // Update — preserva startedAt
    all[existingIdx] = {
      ...draft,
      startedAt: all[existingIdx].startedAt,
      updatedAt: now,
    };
  } else {
    // New — append
    const newDraft: EditDraft = {
      ...draft,
      startedAt: now,
      updatedAt: now,
    };
    all.push(newDraft);
    // Cap em MAX_DRAFTS — descarta o mais antigo se excedeu
    if (all.length > MAX_DRAFTS) {
      all.sort((a, b) => a.updatedAt - b.updatedAt); // mais antigo primeiro
      all.shift(); // remove oldest
    }
  }
  writeDrafts(all);
}

/** Lista todas as edições ativas (max MAX_DRAFTS), ordenadas por updatedAt desc. */
export function getEditDrafts(): EditDraft[] {
  return readDrafts().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Retorna 1 draft pra um matchId específico ou null. */
export function getEditDraftByMatchId(matchId: string): EditDraft | null {
  return readDrafts().find((d) => d.matchId === matchId) ?? null;
}

/** Compat helper — retorna o draft mais recente (1) pra UIs single-slot. */
export function getEditDraft(): EditDraft | null {
  const all = getEditDrafts();
  return all[0] ?? null;
}

/** Remove um draft específico. */
export function clearEditDraft(matchId?: string): void {
  if (typeof window === "undefined") return;
  if (!matchId) {
    // Limpa tudo (compat com chamada legacy sem args)
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_LEGACY);
    notifyChange();
    return;
  }
  const all = readDrafts().filter((d) => d.matchId !== matchId);
  writeDrafts(all);
}

export function clearAllEditDrafts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(KEY_LEGACY);
  notifyChange();
}

export function editingForMinutes(d: EditDraft): number {
  return Math.max(0, Math.floor((Date.now() - d.startedAt) / 60000));
}

export const MAX_EDIT_DRAFTS = MAX_DRAFTS;
