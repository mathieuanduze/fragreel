import Nav from "@/components/Nav";
import LibraryContent from "@/components/LibraryContent";
import AdSlot from "@/components/AdSlot";

export const metadata = { title: "Minhas Demos · FragReel" };

export default function Library() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 48px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
            Demos disponíveis
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 720, lineHeight: 1.6, marginBottom: 18 }}>
            Suas partidas do CS2 + qualquer .dem que você baixou. Selecione uma demo,
            escolha o player que vai protagonizar o reel, e a IA detecta os melhores
            momentos.
          </p>

          {/* Sprint #7 (05/05) — clarifica 2 fontes de demos. Source-agnostic UX:
              tudo aparece numa lista só, badges no card mostram origem. */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 10,
            marginBottom: 12,
          }}>
            <div style={{
              padding: "12px 14px",
              background: "#13131f",
              border: "1px solid #2D2D44",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4CAF82", marginBottom: 2 }}>Automático</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.45 }}>
                  Suas partidas CS2 ficam em <code style={{ color: "#FF6B35", fontSize: 10 }}>csgo/replays/</code> — detectadas automaticamente
                </div>
              </div>
            </div>
            <div style={{
              padding: "12px 14px",
              background: "#13131f",
              border: "1px solid #2D2D44",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⬇</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 2 }}>Manual</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.45 }}>
                  Demos de pro players: download de <a href="https://www.hltv.org/results" target="_blank" rel="noopener" style={{ color: "#FF6B35" }}>HLTV</a> ou <a href="https://csgostats.gg/" target="_blank" rel="noopener" style={{ color: "#FF6B35" }}>CSGOStats</a> e drop em <code style={{ color: "#FF6B35", fontSize: 10 }}>replays/</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ad — leaderboard topo */}
        <div style={{ marginBottom: 28 }}>
          <AdSlot id="library-leaderboard" size="leaderboard" label="HyperX · Headsets oficiais CS2" />
        </div>

        <LibraryContent />

        {/* Ad — native rodapé */}
        <div style={{ marginTop: 32 }}>
          <AdSlot id="library-native" size="native" label="Patrocinado · Logitech G Pro X Superlight" />
        </div>
      </div>
    </div>
  );
}
