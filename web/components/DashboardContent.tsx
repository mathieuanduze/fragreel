"use client";

import { useState, useEffect, useCallback } from "react";
import MatchList from "@/components/MatchList";
import AdSlot from "@/components/AdSlot";
import Link from "next/link";

export default function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh a cada 30s para pegar partidas enviadas pelo client
  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {/* Hero — Download Client */}
      <div style={{
        padding: "32px 36px",
        background: "linear-gradient(135deg, rgba(255,107,53,0.10) 0%, rgba(167,139,250,0.06) 100%)",
        border: "1px solid rgba(255,107,53,0.30)",
        borderRadius: 16,
        marginBottom: 32,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 32,
        alignItems: "center",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>🎬</span>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>FragReel para Windows</span>
            <span style={{ fontSize: 11, background: "#FF6B35", color: "white", padding: "3px 9px", borderRadius: 5, fontWeight: 700, letterSpacing: "0.04em" }}>BETA</span>
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: "0 0 18px", maxWidth: 520 }}>
            O client lê as demos do CS2 que já estão no seu PC e expõe pra esta página.
            Você escolhe qual partida virar FragReel — nenhuma demo sai do seu computador
            sem você clicar.
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#4CAF82", fontSize: 15 }}>✓</span> Lê demos do CS2 localmente
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#4CAF82", fontSize: 15 }}>✓</span> Detecção de highlights por IA
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#4CAF82", fontSize: 15 }}>✓</span> Open source · MIT</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <a
            href="https://github.com/mathieuanduze/fragreel-client/releases/latest/download/FragReel.exe"
            download="FragReel.exe"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#FF6B35",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              padding: "12px 22px",
              borderRadius: 10,
              textDecoration: "none",
              whiteSpace: "nowrap",
              letterSpacing: "-0.01em",
            }}
          >
            ⬇ Baixar client
          </a>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "right" }}>
            Windows 10/11 · ~18 MB
          </span>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 40 }}>
        {[
          { step: "1", icon: "⬇", title: "Baixa e instala", desc: "Instalar FragReel.exe. Login com Steam uma vez só." },
          { step: "2", icon: "📂", title: "Abre a Biblioteca", desc: "O client lista as demos do seu CS2. Você escolhe qual virar FragReel." },
          { step: "3", icon: "🎬", title: "Assiste 1 ad, baixa o vídeo", desc: "Enquanto a IA monta o reel, você assiste 1 anúncio. Pronto, baixou." },
        ].map(({ step, icon, title, desc }) => (
          <div key={step} style={{ padding: "18px 20px", background: "#16213E", border: "1px solid #2D2D44", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FF6B3520", border: "1px solid rgba(255,107,53,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#FF6B35", flexShrink: 0 }}>{step}</div>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.55, margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Ad — leaderboard */}
      <div style={{ marginBottom: 32 }}>
        <AdSlot id="dashboard-leaderboard" size="leaderboard" label="SteelSeries · Periféricos para CS2" />
      </div>

      {/* Match list */}
      <MatchList refreshKey={refreshKey} />

      {/* Ad — native */}
      <div style={{ marginTop: 32 }}>
        <AdSlot id="dashboard-native" size="native" label="Patrocinado · KaBuM! Gaming" />
      </div>
    </>
  );
}
