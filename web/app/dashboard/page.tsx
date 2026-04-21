import Nav from "@/components/Nav";
import MatchList from "@/components/MatchList";
import AdSlot from "@/components/AdSlot";

export default function Dashboard() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 48px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
          <div>
            <div className="tag" style={{ marginBottom: 8 }}>Minhas Partidas</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard</h1>
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", background: "#1A1A2E",
              border: "1px solid #2D2D44", borderRadius: 10,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6B35", boxShadow: "0 0 8px #FF6B35", display: "inline-block" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Client ativo · Monitorando demos</span>
          </div>
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

        {/* Download banner */}
        <div style={{ marginTop: 40, padding: "28px 32px", background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)", border: "1px solid #FF6B3530", borderRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Client FragReel para Windows</div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", maxWidth: 480 }}>
              Instala uma vez e esqueça. O client detecta suas demos automaticamente e processa tudo em background.
            </p>
          </div>
          <a
            href="https://github.com/mathieuanduze/fragreel-releases/releases/download/latest-build/FragReel.exe"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ whiteSpace: "nowrap", textDecoration: "none" }}
          >
            ↓ Baixar · Windows (.exe)
          </a>
        </div>
      </div>
    </div>
  );
}
