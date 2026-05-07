"use client";

import { useEffect, useState } from "react";
import { getLocalClientVersion, pingLocalClient } from "@/lib/local";
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
  // Sprint Install Indicator (06/05) — re-render flag pra mostrar contador
  // de "instalando há Xs" atualizado per-tick. Hook polla a cada intervalMs
  // mas o segundo de instalação muda a cada 1s — usamos 1s timer separado
  // SÓ quando estamos no estado installing.
  const [installSecondsTick, setInstallSecondsTick] = useState(0);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const online = await pingLocalClient();
      if (!alive) return;
      if (!online) {
        setLocal({ value: null, online: false });
        return;
      }
      const version = await getLocalClientVersion();
      if (!alive) return;
      setLocal({ value: version, online: true });
      // Client veio online — limpa flag de install (next render volta pra
      // current path). Banner "instalando" some sozinho.
      clearDownloadClick();
    };

    tick();
    const id = setInterval(tick, intervalMs);

    // Tick extra rápido só pra contador de "instalando há Xs"
    const installSecondsId = setInterval(() => {
      if (alive) setInstallSecondsTick((n) => n + 1);
    }, 1000);

    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(installSecondsId);
      window.removeEventListener("focus", onFocus);
    };
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

  // Ainda não pollou o client local uma vez
  if (local.online === null) {
    // Mesmo em "checking" inicial, se já clicou em download, mostra
    // installing (UX mais clara que "checking" → "offline" → "installing")
    if (installingForSec !== null && isWithinInstallWindow()) {
      return { status: "installing", local: null, required: latest, canRender: false, installingForSec };
    }
    return { status: "checking", local: null, required: latest, canRender: false, installingForSec: null };
  }

  // Client local fechado / não instalado
  if (!local.online) {
    // Sprint Install Indicator: se user clicou em "Baixar" recentemente
    // (last 5min), banner de "instalando" em vez de "offline".
    if (installingForSec !== null && isWithinInstallWindow()) {
      return { status: "installing", local: null, required: latest, canRender: false, installingForSec };
    }
    return { status: "offline", local: null, required: latest, canRender: false, installingForSec: null };
  }

  // Client online mas /version retornou null (versão <= v0.1.x sem endpoint).
  // Versão desconhecida num client online é tratada como outdated por
  // segurança — não dá pra confirmar compat com features novas da web.
  if (!local.value) {
    return { status: "outdated", local: null, required: latest, canRender: false, installingForSec: null };
  }

  // Client online e reportou versão. Cruzamento com GitHub:
  // - Se GitHub API ainda carregando → "checking" (evita flash de status errado)
  // - Se GitHub API falhou (latest === null após loading) → trust local, assume current
  // - Se temos latest → compara com isOutdated()
  if (latestLoading) {
    return { status: "checking", local: local.value, required: latest, canRender: false, installingForSec: null };
  }

  if (!latest) {
    // GitHub API indisponível. Failure mode: trust local client — pior UX
    // seria pedir update sem confirmar que existe release mais nova.
    return { status: "current", local: local.value, required: null, canRender: true, installingForSec: null };
  }

  const stale = isOutdated(local.value, latest);
  return {
    status: stale ? "outdated" : "current",
    local: local.value,
    required: latest,
    canRender: !stale,
    installingForSec: null,
  };
}
