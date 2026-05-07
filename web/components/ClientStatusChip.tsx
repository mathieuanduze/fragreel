"use client";

import { useClientVersionStatus } from "@/lib/useClientVersionStatus";
import DownloadButton from "./DownloadButton";

/**
 * Chip de status no header. 4 estados:
 *   - checking → cinza, "verificando…"
 *   - online + atualizado → verde, "✓ Client conectado"
 *   - online + desatualizado → amarelo, "⚠ Atualizar · vX → vY" (link p/ download)
 *   - offline → laranja, "⬇ Baixar client · vY" (link p/ download)
 *
 * Polling a cada 8s (e ao focar a aba). Compartilha o hook
 * `useClientVersionStatus` com o gate de render no MatchClient.
 */
export default function ClientStatusChip() {
  const { status, local, required } = useClientVersionStatus();

  if (status === "checking") {
    return (
      <span
        title="Verificando se o FragReel client está rodando…"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 500,
          color: "rgba(255,255,255,0.45)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
        verificando…
      </span>
    );
  }

  if (status === "current") {
    return (
      <span
        title={`FragReel client ${local} rodando em 127.0.0.1:5775`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          color: "#5be38f",
          background: "rgba(91,227,143,0.10)",
          border: "1px solid rgba(91,227,143,0.35)",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5be38f" }} />
        Client conectado
      </span>
    );
  }

  if (status === "outdated") {
    return (
      <DownloadButton
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          color: "#FFC107",
          background: "rgba(255,193,7,0.10)",
          border: "1px solid rgba(255,193,7,0.45)",
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>⚠</span>
        Atualizar · {local ?? "?"} → {required}
      </DownloadButton>
    );
  }

  // offline → CTA pra baixar
  return (
    <DownloadButton
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "#FF6B35",
        background: "rgba(255,107,53,0.10)",
        border: "1px solid rgba(255,107,53,0.45)",
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>⬇</span>
      Baixar client · {required}
    </DownloadButton>
  );
}
