import Nav from "@/components/Nav";
import LibraryContent from "@/components/LibraryContent";
import AdSlot from "@/components/AdSlot";

export const metadata = { title: "Minhas Demos · FragReel" };

export default function Library() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 48px" }}>
        <div style={{ marginBottom: 28 }}>
          <div className="tag" style={{ marginBottom: 8 }}>Demos detectadas no seu PC</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
            Minhas Demos
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 620, lineHeight: 1.6 }}>
            Selecione uma partida para gerar um FragReel. A demo é enviada do seu PC pra análise — você assiste um anúncio enquanto a IA detecta os melhores momentos.
          </p>
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
