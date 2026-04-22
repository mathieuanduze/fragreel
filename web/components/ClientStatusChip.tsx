"use client";

import { useEffect, useState } from "react";
import { pingLocalClient } from "@/lib/local";

type Status = "checking" | "online" | "offline";

/**
 * Pinga 127.0.0.1:5775/health a cada 8s (e ao focar a aba).
 * Mostra "✓ Client conectado" (verde) quando o desktop client está rodando,
 * ou um link "⬇ Baixar client" (laranja) quando não está.
 */
export default function ClientStatusChip() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      const ok = await pingLocalClient();
      if (!alive) return;
      setStatus(ok ? "online" : "offline");
    };

    tick();
    timer = setInterval(tick, 8000);

    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

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

  if (status === "online") {
    return (
      <span
        title="FragReel client rodando em 127.0.0.1:5775"
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

  // offline → CTA pra baixar
  return (
    <a
      href="/download"
      download="FragReel.exe"
      title="Baixar o FragReel client (Windows)"
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
        textDecoration: "none",
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>⬇</span>
      Baixar client
    </a>
  );
}
