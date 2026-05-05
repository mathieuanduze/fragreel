import Nav from "@/components/Nav";
import Link from "next/link";
import { getLatestClientVersion } from "@/lib/server/getLatestClientVersion";

const MAPS = [
  { id: "de_dust2",    name: "Dust2" },
  { id: "de_mirage",   name: "Mirage" },
  { id: "de_inferno",  name: "Inferno" },
  { id: "de_nuke",     name: "Nuke" },
  { id: "de_ancient",  name: "Ancient" },
  { id: "de_anubis",   name: "Anubis" },
  { id: "de_vertigo",  name: "Vertigo" },
  { id: "de_overpass", name: "Overpass" },
];

const STATS = [
  { label: "1v3 CLUTCH",     sub: "AK-47 · 2 HS",          color: "#FF6B35" },
  { label: "DEFUSE",         sub: "+2K · win",             color: "#34d399" },
  { label: "PLANT WON",      sub: "Galil · 40s",           color: "#fbbf24" },
  { label: "ACE",            sub: "5 kills · 1 round",     color: "#a78bfa" },
];

// v0.7.0 LP rewrite (05/05): reduzido ~50% do texto pós-feedback Mathieu
// "tem muito texto". Princípio: 1 frase por bloco, action-oriented, deixa
// o vídeo demo (Sprint #3) carregar a explicação visual quando disponível.
const steps = [
  { num: "01", title: "Baixe o client",    desc: "Windows. Login Steam. Pronto." },
  { num: "02", title: "Escolha a partida", desc: "Detecta as demos do CS2 automaticamente." },
  { num: "03", title: "Veja 1 anúncio",    desc: "30s enquanto seu PC renderiza." },
  { num: "04", title: "MP4 no Desktop",    desc: "Pronto pra postar TikTok / Reels / YouTube." },
];

const features = [
  { icon: "🎯", label: "Scoreboard ao vivo" },
  { icon: "💀", label: "Killfeed sintético" },
  { icon: "💣", label: "Plant + Defuse" },
  { icon: "🎵", label: "4 trilhas de mood" },
  { icon: "👁",  label: "X-ray opcional" },
  { icon: "🎬", label: "Vertical ou horizontal" },
];

const reasons = [
  { label: "Sem upload, sem OBS",       sub: "Lê demos do CS2 localmente." },
  { label: "Render 100% local",          sub: "Vídeo nunca sai do seu PC." },
  { label: "Scoring HLTV-style",         sub: "Clutches, ACEs, plants, defuses." },
  { label: "Open source · grátis",       sub: "MIT auditável. Sem assinatura." },
];

// Server Component async: pega a última versão publicada no GitHub pra
// exibir nos CTAs de download. Fetch server-side tem cache de 5min, então
// esta page só re-renderiza a cada 5min no ISR do Next.
export default async function Home() {
  const { latest } = await getLatestClientVersion();
  const versionSuffix = latest ? ` · ${latest}` : "";
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />

      {/* ── Hero — enxuto, foco no headline + CTAs ───────────────────── */}
      <section style={{ paddingTop: 130, paddingBottom: 60, paddingLeft: 24, paddingRight: 24, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }}>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "6px 14px", background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "#FF6B35", letterSpacing: "0.03em" }}>
            <img src="/cs2-icon.png" alt="CS2" width={20} height={20} style={{ borderRadius: 4, objectFit: "cover" }} />
            Counter-Strike 2 · Exclusivo
          </div>

          <h1 style={{ fontSize: "clamp(40px, 6.5vw, 76px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 20 }}>
            Seus frags com{" "}
            <span style={{ color: "#FF6B35" }}>cinematografia</span>
            <br />
            de Major.{" "}
            <span style={{ color: "rgba(255,255,255,0.3)" }}>De graça.</span>
          </h1>

          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 540, margin: "0 auto 28px" }}>
            Reel pronto pra postar a partir das suas demos do CS2. Sem upload, sem assinatura.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 28 }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ padding: "5px 12px", background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.color, letterSpacing: "0.04em" }}>{s.label}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{s.sub}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/download" download="FragReel.exe" className="btn-primary" style={{ fontSize: 16, padding: "14px 32px", textDecoration: "none" }}>
              ⬇ Baixar grátis · Windows{versionSuffix}
            </a>
            <Link href="/login" className="btn-ghost" style={{ fontSize: 16 }}>
              Entrar com Steam →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Demo video placeholder (Sprint #3 — wire quando Mathieu mandar MP4) ───
          Quando Mathieu mandar o MP4 killer, trocar essa div pelo <video>:
            <video autoPlay muted loop playsInline poster="/demo-poster.jpg">
              <source src="<R2 url>" type="video/mp4" />
            </video>
          Por enquanto: placeholder pra reservar o slot visual. */}
      <section style={{ padding: "0 24px 60px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{
          aspectRatio: "9 / 16",
          maxWidth: 360,
          margin: "0 auto",
          borderRadius: 18,
          background: "linear-gradient(180deg, #1A1A2E 0%, #16213E 100%)",
          border: "1px solid #2D2D44",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.25)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          ▶ Demo em breve
        </div>
      </section>

      {/* ── Mapas — minimal ─────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 60px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", marginBottom: 16, textTransform: "uppercase" }}>
          Pool competitivo CS2
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {MAPS.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "#16213E", border: "1px solid #2D2D44" }}>
                <img src={`/maps/${m.id}.png`} alt={m.name} width={48} height={48} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{m.name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid — sem H2, sem paragraph, só cards com 1 label ── */}
      <section style={{ padding: "60px 24px", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {features.map((feat) => (
            <div key={feat.label} style={{ padding: "14px 14px", background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{feat.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{feat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Por que FragReel — 4 cards com 1 frase só ─────────────── */}
      <section style={{ padding: "60px 24px", background: "#1A1A2E", borderTop: "1px solid #2D2D44", borderBottom: "1px solid #2D2D44" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 32 }}>
            Feito pra jogador de CS2
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left" }}>
            {reasons.map((f) => (
              <div key={f.label} style={{ padding: "16px 18px", background: "#0D0D1A", border: "1px solid #2D2D44", borderRadius: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "#FF6B35" }}>✓ {f.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.45 }}>{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona — 4 steps tightened ───────────────────────── */}
      <section style={{ padding: "60px 24px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 40 }}>
            Como funciona
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
            {steps.map((s) => (
              <div key={s.num}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginBottom: 12, color: "white" }}>
                  {s.num}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ad transparency — chip de fluxo + privacy ─────────────── */}
      <section style={{ padding: "60px 24px", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "12px 20px", background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 12, fontSize: 12, color: "rgba(255,255,255,0.5)", flexWrap: "wrap", justifyContent: "center" }}>
          <span>🎮 Jogue</span>
          <span style={{ color: "#2D2D44" }}>→</span>
          <span>📺 30s ad</span>
          <span style={{ color: "#2D2D44" }}>→</span>
          <span style={{ color: "#FF6B35", fontWeight: 700 }}>🎬 MP4</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          🔒 Vídeos nunca saem do seu PC.{" "}
          <Link href="/privacy" style={{ color: "#FF6B35", textDecoration: "none", borderBottom: "1px dotted #FF6B35" }}>Privacidade</Link>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px", textAlign: "center", borderTop: "1px solid #2D2D44" }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 24 }}>
          Pronto?
        </h2>
        <a href="/download" download="FragReel.exe" className="btn-primary" style={{ fontSize: 16, padding: "14px 36px", textDecoration: "none" }}>
          ⬇ Baixar grátis{versionSuffix}
        </a>
        <p style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          Windows 10/11 · CS2 instalado · Login Steam
        </p>
      </section>

      <footer style={{ padding: "32px 24px", borderTop: "1px solid #2D2D44", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
          <Link href="/privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Privacidade</Link>
          <a href="https://github.com/mathieuanduze/fragreel-client" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>GitHub (client)</a>
          <a href="https://github.com/mathieuanduze/fragreel" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>GitHub (site)</a>
          <a href="https://signpath.org/foundation" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>SignPath</a>
        </div>
        <div>FragReel · 2026 · MIT · Não afiliado à Valve</div>
      </footer>
    </div>
  );
}
