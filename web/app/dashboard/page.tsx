import Nav from "@/components/Nav";
import Link from "next/link";
import { getMatches, MatchSummary } from "@/lib/api";
import AdSlot from "@/components/AdSlot";


export default async function Dashboard() {
  let matches: MatchSummary[] = [];
  try {
    matches = await getMatches();
  } catch {
    // API offline — show empty state
  }

  const ready = matches.filter((m) => m.status === "ready");
  const totalHighlights = matches.reduce((s, m) => s + m.highlights_count, 0);
  const bestRating = matches.length
    ? Math.max(...matches.map((m) => parseFloat(m.rating))).toFixed(2)
    : "—";
  const totalKills = matches.reduce((s, m) => {
    const [k] = m.kd.split("/");
    return s + (parseInt(k) || 0);
  }, 0);

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

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 40 }}>
          {[
            { label: "Partidas processadas", value: String(ready.length) },
            { label: "Vídeos gerados",        value: String(totalHighlights) },
            { label: "Melhor rating",          value: bestRating },
            { label: "Total de frags",         value: String(totalKills) },
          ].map((s) => (
            <div key={s.label} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#FF6B35", marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Ad — leaderboard abaixo dos stats */}
        <div style={{ marginBottom: 32 }}>
          <AdSlot id="dashboard-leaderboard" size="leaderboard" label="SteelSeries · Periféricos para CS2" />
        </div>

        {/* Match list */}
        {matches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎮</div>
            <div>Nenhuma partida encontrada. Instale o client e jogue uma partida.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {matches.map((m) => (
              <div
                key={m.id}
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto auto",
                  alignItems: "center",
                  gap: 20,
                  padding: "16px 20px",
                  opacity: m.status === "processing" ? 0.7 : 1,
                }}
              >
                <img
                  src={`/maps/${m.map}.png`}
                  alt={m.map.replace("de_", "")}
                  width={48}
                  height={48}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                />

                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                    {m.map.replace("de_", "").charAt(0).toUpperCase() + m.map.replace("de_", "").slice(1)}
                    <span style={{ marginLeft: 10, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{m.date}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                    Top play: <span style={{ color: "rgba(255,255,255,0.7)" }}>{m.top_play}</span>
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: m.score.split("–").map(Number)[0] > m.score.split("–").map(Number)[1] ? "#4CAF82" : "#E05555" }}>
                    {m.score}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>K/D: {m.kd}</div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{m.rating}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Rating</div>
                </div>

                <div>
                  {m.status === "ready" ? (
                    <Link
                      href={`/match/${m.id}`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "8px 16px", background: "#FF6B35", color: "white",
                        borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
                      }}
                    >
                      🎬 Ver highlights
                    </Link>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#1A1A2E", border: "1px solid #2D2D44", color: "rgba(255,255,255,0.5)", borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                      ⚙️ Processando...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ad — native entre lista e banner de download */}
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
          <button className="btn-primary" style={{ whiteSpace: "nowrap" }}>↓ Baixar · v0.1-beta</button>
        </div>
      </div>
    </div>
  );
}
