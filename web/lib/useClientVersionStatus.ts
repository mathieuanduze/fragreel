"use client";

import { useEffect, useState } from "react";
import { getLocalClientVersion, pingLocalClient, getInstallStatus, type InstallStatus } from "@/lib/local";
import { useLatestClientVersion } from "@/lib/useLatestClientVersion";
import { isOutdated } from "@/lib/version-compare";
import { isWithinInstallWindow, clearDownloadClick, secondsSinceDownloadClick } from "@/lib/installState";

export type ClientStatus = "checking" | "offline" | "outdated" | "current" | "installing";

export interface ClientVersionStatus {
  status: ClientStatus;
  /** Versão reportada pelo `.exe` rodando, ou null se offline. */
  local: string | null;
  /**
   * Última versão publicada (tag GitHub release). Null enquanto
   * `/api/client-version` não respondeu ou se a chamada falhou. Substituiu
   * a constante `CLIENT_VERSION` hardcoded em `lib/version.ts`.
   */
  required: string | null;
  /** Conveniência pra callsites que decidem se podem rodar render. */
  canRender: boolean;
  /** Sprint Install Indicator (06/05) — segundos desde o click "Baixar".
   *  Null se não tem janela de instalação ativa OU client já online. */
  installingForSec: number | null;
  /** Sprint Install Indicator B (06/05) — payload do /install-status do
   *  client. Disponível QUANDO o client está respondendo (mesmo durante
   *  setup, via install_progress_server.py minimal HTTP server). Null
   *  quando client offline. Banner usa pra mostrar progresso real ao
   *  invés de timing-based. */
  installStatus: InstallStatus | null;
}

/**
 * Polla `/health` + `/version` do client local em 127.0.0.1:5775
 * a cada `intervalMs` (e ao focar a aba), e cruza com a última release
 * publicada no GitHub (via `useLatestClientVersion` → `/api/client-version`
 * → GitHub API, com cache 5min).
 *
 * Estados:
 *   - "checking"  → primeiro tick não rolou ainda OU ainda não temos resposta do GitHub
 *   - "offline"   → fetch do client local falhou (.exe fechado / não instalado)
 *   - "outdated"  → client online mas versão < última publicada no GitHub
 *   - "current"   → client online e atualizado
 *
 * Fallback quando GitHub API falha (ex: rate limit, downtime): tratamos
 * como `current` se o client local responde — é o failure mode seguro,
 * não pede update sem ter confirmação de que existe um mais novo. Isso
 * evita pedir update em loop por instabilidade de infra.
 *
 * `canRender` é false em "offline" e "outdated" — usado pelos CTAs de
 * render como hard gate. Sem auto-update no client, deixar usuário
 * antigo gerar reels é UX ruim (eles vão produzir ProRes .mov ilegível
 * em WMP, ou trombar em endpoints novos como /render/open).
 */
export function useClientVersionStatus(intervalMs = 8000): ClientVersionStatus {
  const { latest, loading: latestLoading } = useLatestClientVersion();
  const [local, setLocal] = useState<{ value: string | null; online: boolean | null }>(
    { value: null, online: null },
  );
  // Sprint Install Indicator B (06/05) — install_status do client servido
  // pelo install_progress_server.py durante setup OU pelo Flask full pós-
  // setup. Banner usa pra mostrar progresso REAL.
  const [installStatus, setInstallStatus] = useState<InstallStatus | null>(null);
  // Sprint Install Indicator (06/05) — re-render flag pra mostrar contador
  // de "instalando há Xs" atualizado per-tick.
  const [installSecondsTick, setInstallSecondsTick] = useState(0);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const online = await pingLocalClient();
      if (!alive) return;
      if (!online) {
        setLocal({ value: null, online: false });
        setInstallStatus(null);
        return;
      }
      const version = await getLocalClientVersion();
      if (!alive) return;
      setLocal({ value: version, online: true });
      // Client veio online — limpa flag de install (next render volta pra
      // current path). Banner "instalando" some sozinho.
      clearDownloadClick();
      // Plus polla install-status pra payload real (progresso de setup
      // OU ready=true se Flask full está rodando).
      const status = await getInstallStatus();
      if (alive) setInstallStatus(status);
    };

    // Sprint Install Indicator B — tick MAIS RÁPIDO pra detectar client
    // logo que aparece em setup. 8s era OK pra "checking online", mas
    // pra UX de "user clicou .exe agora", queremos detectar < 1s.
    const fastTick = async () => {
      if (!alive) return;
      const status = await getInstallStatus();
      if (!alive) return;
      if (status) {
        setInstallStatus(status);
        // Se temos install_status response, client está online — full
        // tick atualiza version cache na próxima janela.
        if (local.online !== true) {
          // Force a normal tick pra capturar version
          tick();
        }
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);

    // Fast poll quando suspect installing (download click recente)
    // pra UX de banner aparecer ASAP após .exe abrir
    const fastId = setInterval(() => {
      if (isWithinInstallWindow() || installStatus === null) {
        fastTick();
      }
    }, 1500);

    // Tick 1Hz pra contador de tempo no banner
    const installSecondsId = setInterval(() => {
      if (alive) setInstallSecondsTick((n) => n + 1);
    }, 1000);

    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    // Round 2 fix (07/05 noite): markDownloadClicked / clearDownloadClick
    // disparam StorageEvent no MESMO tab pra forçar re-render imediato
    // (default browser só dispara em outras tabs). Sem isso, Nav levava
    // até 1.5s pra mostrar banner após click — Mathieu reportou issue.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fragreel:downloadClickedAt" || e.key === null) {
        // Force re-render do hook lendo flag atualizada
        setInstallSecondsTick((n) => n + 1);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(fastId);
      clearInterval(installSecondsId);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  // Read-time check: se user clicou em "Baixar" na janela de install,
  // computa segundos pra mostrar progress no banner. Re-renderiza
  // dependendo de installSecondsTick (1Hz refresh).
  const installingForSec =
    local.online === false || local.online === null
      ? secondsSinceDownloadClick()
      : null;

  // Mark as used pra TS não warnar (efeito é só forçar re-render)
  void installSecondsTick;

  // Sprint Install Indicator B (06/05) — install_status pode estar
  // disponível MESMO com client.local.online=false (Flask não respondeu
  // /version mas install_progress_server.py respondeu /install-status).
  // Esse é o caso DURANTE first-run setup. Detect installing aqui ANTES
  // de checar local.online.
  if (installStatus && !installStatus.ready) {
    return {
      status: "installing",
      local: null,
      required: latest,
      canRender: false,
      installingForSec: installingForSec,
      installStatus,
    };
  }

  // Ainda não pollou o client local uma vez
  if (local.online === null) {
    // Mesmo em "checking" inicial, se já clicou em download, mostra
    // installing (UX mais clara que "checking" → "offline" → "installing")
    if (installingForSec !== null && isWithinInstallWindow()) {
      return { status: "installing", local: null, required: latest, canRender: false, installingForSec, installStatus: null };
    }
    return { status: "checking", local: null, required: latest, canRender: false, installingForSec: null, installStatus: null };
  }

  // Client local fechado / não instalado
  if (!local.online) {
    // Sprint Install Indicator: se user clicou em "Baixar" recentemente
    // (last 5min), banner de "instalando" em vez de "offline".
    if (installingForSec !== null && isWithinInstallWindow()) {
      return { status: "installing", local: null, required: latest, canRender: false, installingForSec, installStatus: null };
    }
    return { status: "offline", local: null, required: latest, canRender: false, installingForSec: null, installStatus: null };
  }

  // Client online mas /version retornou null (versão <= v0.1.x sem endpoint).
  // Versão desconhecida num client online é tratada como outdated por
  // segurança — não dá pra confirmar compat com features novas da web.
  if (!local.value) {
    return { status: "outdated", local: null, required: latest, canRender: false, installingForSec: null, installStatus };
  }

  // Client online e reportou versão. Cruzamento com GitHub:
  if (latestLoading) {
    return { status: "checking", local: local.value, required: latest, canRender: false, installingForSec: null, installStatus };
  }

  if (!latest) {
    // GitHub API indisponível. Failure mode: trust local client.
    return { status: "current", local: local.value, required: null, canRender: true, installingForSec: null, installStatus };
  }

  const stale = isOutdated(local.value, latest);
  return {
    status: stale ? "outdated" : "current",
    local: local.value,
    required: latest,
    canRender: !stale,
    installingForSec: null,
    installStatus,
  };
}
