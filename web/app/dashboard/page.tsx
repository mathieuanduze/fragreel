import Nav from "@/components/Nav";
import DashboardContent from "@/components/DashboardContent";

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

        <DashboardContent />
      </div>
    </div>
  );
}
