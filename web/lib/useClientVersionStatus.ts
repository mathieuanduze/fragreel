"use client";

import { useEffect, useState } from "react";
import { getLocalClientVersion, pingLocalClient } from "@/lib/local";
import { useLatestClientVersion } from "@/lib/useLatestClientVersion";
import { isOutdated } from "@/lib/version-compare";

export type ClientStatus = "checking" | "offline" | "outdated" | "current";

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

  // Ainda não pollou o client local uma vez
  if (local.online === null) {
    return { status: "checking", local: null, required: latest, canRender: false };
  }

  // Client local fechado / não instalado
  if (!local.online) {
    return { status: "offline", local: null, required: latest, canRender: false };
  }

  // Client online mas /version retornou null (versão <= v0.1.x sem endpoint).
  // Versão desconhecida num client online é tratada como outdated por
  // segurança — não dá pra confirmar compat com features novas da web.
  if (!local.value) {
    return { status: "outdated", local: null, required: latest, canRender: false };
  }

  // Client online e reportou versão. Cruzamento com GitHub:
  // - Se GitHub API ainda carregando → "checking" (evita flash de status errado)
  // - Se GitHub API falhou (latest === null após loading) → trust local, assume current
  // - Se temos latest → compara com isOutdated()
  if (latestLoading) {
    return { status: "checking", local: local.value, required: latest, canRender: false };
  }

  if (!latest) {
    // GitHub API indisponível. Failure mode: trust local client — pior UX
    // seria pedir update sem confirmar que existe release mais nova.
    return { status: "current", local: local.value, required: null, canRender: true };
  }

  const stale = isOutdated(local.value, latest);
  return {
    status: stale ? "outdated" : "current",
    local: local.value,
    required: latest,
    canRender: !stale,
  };
}
