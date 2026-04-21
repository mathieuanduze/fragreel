import Nav from "@/components/Nav";
import MatchList from "@/components/MatchList";
import AdSlot from "@/components/AdSlot";
import DemoUpload from "@/components/DemoUpload";

export default function Dashboard() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 48px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div className="tag" style={{ marginBottom: 8 }}>Minhas Partidas</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard</h1>
        </div>

        {/* Demo upload */}
        <div style={{ marginBottom: 32 }}>
          <DemoUpload />
        </div>

        {/* Ad — leaderboard */}
        <div style={{ marginBottom: 32 }}>
          <AdSlot id="dashboard-leaderboard" size="leaderboard" label="SteelSeries · Periféricos para CS2" />
        </div>

        {/* Match list — client component that fetches with JWT */}
        <MatchList />

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
      </div>
    </div>
  );
}
