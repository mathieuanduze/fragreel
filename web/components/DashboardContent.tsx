"use client";

import { useState } from "react";
import DemoUpload from "@/components/DemoUpload";
import MatchList from "@/components/MatchList";
import AdSlot from "@/components/AdSlot";

export default function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      {/* Dois modos lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>

        {/* Modo A — Client automático */}
        <div style={{ padding: "20px 24px", background: "linear-gradient(135deg,rgba(255,107,53,0.08),rgba(167,139,250,0.04))", border: "1px solid rgba(255,107,53,0.25)", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>🔴</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Client automático</span>
            <span style={{ fontSize: 11, background: "#FF6B35", color: "white", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>EM BREVE</span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 12px" }}>
            Instala uma vez e esquece. O client grava o CS2 automaticamente,
            detecta seus highlights e envia o vídeo pronto para cá.
          </p>
          <div style={{ fontSize: 12, color: "rgba(255,107,53,0.7)", fontWeight: 600 }}>
            🎬 Clipes reais de gameplay · sem configuração · sem OBS
          </div>
        </div>

        {/* Modo B — Upload manual */}
        <div style={{ padding: "20px 24px", background: "#16213E", border: "1px solid #2D2D44", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>📁</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Upload manual</span>
            <span style={{ fontSize: 11, background: "#2D2D44", color: "rgba(255,255,255,0.6)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>DISPONÍVEL</span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 12px" }}>
            Arraste o arquivo <code style={{ background: "#0D0D1A", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>.dem</code> da
            sua partida. A IA detecta os highlights — sem vídeo por enquanto.
          </p>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            📂 CS2 / game / csgo / replays /
          </div>
        </div>
      </div>

      {/* Demo upload */}
      <div style={{ marginBottom: 32 }}>
        <DemoUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
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
