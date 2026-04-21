"use client";

import { useState } from "react";
import DemoUpload from "@/components/DemoUpload";
import MatchList from "@/components/MatchList";
import AdSlot from "@/components/AdSlot";

export default function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      {/* Demo upload */}
      <div style={{ marginBottom: 32 }}>
        <DemoUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Ad — leaderboard */}
      <div style={{ marginBottom: 32 }}>
        <AdSlot id="dashboard-leaderboard" size="leaderboard" label="SteelSeries · Periféricos para CS2" />
      </div>

      {/* Match list — re-fetches whenever refreshKey increments */}
      <MatchList refreshKey={refreshKey} />

      {/* Ad — native */}
      <div style={{ marginTop: 32 }}>
        <AdSlot id="dashboard-native" size="native" label="Patrocinado · KaBuM! Gaming" />
      </div>

      {/* Upload tip */}
      <div style={{ marginTop: 40, padding: "24px 28px", background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>📂 Onde está o arquivo .dem?</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: 560, margin: 0 }}>
          Após cada partida competitiva, o CS2 salva a demo automaticamente. Acesse:{" "}
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.7)", background: "#0D0D1A", padding: "2px 6px", borderRadius: 4 }}>
            Steam / steamapps / common / Counter-Strike Global Offensive / game / csgo / replays /
          </span>
        </p>
      </div>
    </>
  );
}
