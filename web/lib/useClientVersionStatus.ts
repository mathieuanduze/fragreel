"use client";

import { useEffect, useState } from "react";
import { getLocalClientVersion, pingLocalClient } from "@/lib/local";
import { CLIENT_VERSION } from "@/lib/version";
import { isOutdated } from "@/lib/version-compare";

export type ClientStatus = "checking" | "offline" | "outdated" | "current";

export interface ClientVersionStatus {
  status: ClientStatus;
  /** Versão reportada pelo `.exe` rodando, ou null se offline. */
  local: string | null;
  /** Versão alvo que a web exige (vem de `lib/version.ts`). */
  required: string;
  /** Conveniência pra callsites que decidem se podem rodar render. */
  canRender: boolean;
}

/**
 * Polla `/health` + `/version` do client local em 127.0.0.1:5775
 * a cada `intervalMs` (e ao focar a aba).
 *
 * Estados:
 *   - "checking"  → primeiro tick não rolou ainda
 *   - "offline"   → fetch falhou (client fechado / não instalado)
 *   - "outdated"  → client respondeu mas versão < CLIENT_VERSION
 *   - "current"   → client rodando e atualizado
 *
 * `canRender` é false em "offline" e "outdated" — usado pelos CTAs de
 * render como hard gate. Sem auto-update no client, deixar usuário
 * antigo gerar reels é UX ruim (eles vão produzir ProRes .mov ilegível
 * em WMP, ou trombar em endpoints novos como /render/open).
 */
export function useClientVersionStatus(intervalMs = 8000): ClientVersionStatus {
  const [state, setState] = useState<ClientVersionStatus>({
    status: "checking",
    local: null,
    required: CLIENT_VERSION,
    canRender: false,
  });

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const online = await pingLocalClient();
      if (!alive) return;
      if (!online) {
        setState({ status: "offline", local: null, required: CLIENT_VERSION, canRender: false });
        return;
      }
      // Online → buscar versão. Clients <= v0.1.x não expõem /version,
      // nesse caso `getLocalClientVersion` retorna null. Versão desconhecida
      // num client online é tratada como outdated por segurança (não dá
      // pra confirmar compat).
      const local = await getLocalClientVersion();
      if (!alive) return;
      if (!local) {
        setState({
          status: "outdated",
          local: null,
          required: CLIENT_VERSION,
          canRender: false,
        });
        return;
      }
      const stale = isOutdated(local, CLIENT_VERSION);
      setState({
        status: stale ? "outdated" : "current",
        local,
        required: CLIENT_VERSION,
        canRender: !stale,
      });
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

  return state;
}
