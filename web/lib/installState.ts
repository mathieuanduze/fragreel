/**
 * installState.ts — Sprint Install Indicator (06/05).
 *
 * Mathieu spec: "Tem como ter um identificador no fragreel, no site que,
 * quando o exe foi baixado e clicado, mostra que está sendo instalado o
 * client?".
 *
 * Estratégia: localStorage flag setado no click do botão "Baixar".
 * Hook useClientVersionStatus consulta esse flag — se ainda está dentro
 * de janela INSTALL_WINDOW_MS (5min) E client local não respondeu, status
 * vira "installing" em vez de "offline" → UI mostra banner "Instalando o
 * client...".
 *
 * Janela 5min escolhida por:
 *   - download FragReel.exe ~120MB → 30s-3min em conexão típica
 *   - first-run setup (vendor: HLAE+Node+ffmpeg+editor ~210MB) → 30-60s
 *   - total ~1-4min worst case
 *   - 5min cobre 95% dos casos sem ficar "preso" em installing pra sempre
 */

const KEY = "fragreel:downloadClickedAt";
const SMARTSCREEN_KEY = "fragreel:smartscreenWarningSeen";
const INSTALL_WINDOW_MS = 5 * 60 * 1000; // 5min

/**
 * Set flag de download click. Chamado pelos onClick dos botões "Baixar"
 * espalhados pela LP + outros lugares. Idempotente.
 *
 * 07/05 fix: dispara `storage` event no mesmo tab pra forçar re-render
 * IMEDIATO de Nav (que lê isWithinInstallWindow via useClientVersionStatus).
 * Default browser só dispara `storage` em OUTRAS tabs — sem isso, Nav
 * só re-renderiza no próximo tick do hook (até 1.5s). Mathieu reportou
 * 07/05 que click no chip do header não mostrava banner — era latência
 * de poll, não bug de lógica.
 */
export function markDownloadClicked(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
    // Force same-tab listeners pra atualizar imediato
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  } catch {
    // localStorage pode falhar em private mode / disabled — graceful skip
  }
}

/**
 * Returns true se user clicou em "Baixar" nos últimos INSTALL_WINDOW_MS.
 * False caso nunca clicou, ou janela expirou.
 */
export function isWithinInstallWindow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < INSTALL_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Limpa flag — chamado quando client veio online (success path) pra
 * evitar cobrir um restart legítimo do client com banner "instalando".
 */
export function clearDownloadClick(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * SmartScreen warning modal — Sprint Ship Unsigned (07/05, refinado round 2).
 *
 * Mathieu spec pós-rejeição SignPath: como ship é unsigned por
 * enquanto, user vai topar com SmartScreen ao abrir o .exe. Modal
 * educa sobre o flow "Mais informações → Executar mesmo assim"
 * + tranquiliza ("estamos em fase beta") + FAQ.
 *
 * **Round 2 (07/05 noite)**: Mathieu reportou que modal não apareceu no
 * teste de campo — flag `smartscreenWarningSeen` tinha sido setada em
 * teste anterior. Refactor: modal aparece SEMPRE por padrão (porque é
 * info importante toda vez que user re-instala). Opt-out explícito via
 * checkbox "Não mostrar novamente" que seta `smartscreenOptOut`. Mais
 * conservador: prefer mostrar info redundante a esconder por flag stale.
 */
export function setSmartScreenOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optOut) {
      window.localStorage.setItem(SMARTSCREEN_KEY, "1");
    } else {
      window.localStorage.removeItem(SMARTSCREEN_KEY);
    }
  } catch {
    // ignore
  }
}

export function isSmartScreenOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SMARTSCREEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Tempo desde o último click de download em segundos. Null se nunca
 * clicou ou janela expirou. Pra UI mostrar "Instalando há Xs".
 */
export function secondsSinceDownloadClick(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return null;
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec * 1000 >= INSTALL_WINDOW_MS) return null;
    return sec;
  } catch {
    return null;
  }
}
