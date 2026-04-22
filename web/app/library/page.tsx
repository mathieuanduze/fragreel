import Nav from "@/components/Nav";
import LibraryContent from "@/components/LibraryContent";

export const metadata = { title: "Biblioteca · FragReel" };

export default function Library() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 48px" }}>
        <div style={{ marginBottom: 28 }}>
          <div className="tag" style={{ marginBottom: 8 }}>Suas Demos</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
            Biblioteca
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 620, lineHeight: 1.6 }}>
            Selecione uma partida para gerar um FragReel. A demo é enviada do seu PC pra análise — você assiste um anúncio enquanto a IA detecta os melhores momentos.
          </p>
        </div>
        <LibraryContent />
      </div>
    </div>
  );
}
