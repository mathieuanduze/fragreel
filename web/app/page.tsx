import Nav from "@/components/Nav";
import Link from "next/link";
import { getLatestClientVersion } from "@/lib/server/getLatestClientVersion";
import DownloadButton from "@/components/DownloadButton";
import HeroCTA from "@/components/HeroCTA";

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

// v0.7.0 LP rewrite (05/05): reduzido pós-feedback Mathieu "tem muito texto".
// Update 05/05 #2: "Como funciona" pode ter mais texto — section principal
// de explicação do produto, vale dar contexto. Demais sections continuam tight.
const steps = [
  {
    num: "01",
    title: "Baixe o client",
    desc: "FragReel.exe pra Windows (~120 MB). Login Steam pra detectar suas demos. Sem assinatura, sem cadastro extra.",
  },
  {
    num: "02",
    title: "Escolha a partida",
    desc: "O client lista as demos que o CS2 já salva no seu PC + qualquer .dem que você baixar (HLTV, CSGOStats). Click na que você quer.",
  },
  {
    num: "03",
    title: "Veja 1 anúncio",
    desc: "Render leva ~15-20min no seu PC (HLAE captura + ffmpeg encode + Remotion edit). Você assiste 1 ad de 30s — é o que sustenta o site grátis.",
  },
  {
    num: "04",
    title: "MP4 no Desktop",
    desc: "Vídeo final pronto na sua área de trabalho (~30-40 MB). Vertical pra TikTok/Reels/Shorts ou horizontal pra YouTube/Twitch — você escolhe na hora.",
  },
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

          {/* H1 06/05 (round 3 — Mathieu refinou: "faça [3 linhas] só no
              desktop, no mobile não precisa").
              Mobile (< 768px): linhas wrap natural se viewport for narrow,
                pode virar 4+ linhas. OK — mobile typography prioriza fit,
                não estética rígida.
              Desktop (≥ 768px): className .hero-h1-line aplica nowrap →
                3 linhas garantidas via display: block + nowrap.
              CSS em globals.css. */}
          <h1 style={{ fontSize: "clamp(32px, 5.5vw, 64px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 20 }}>
            <span className="hero-h1-line">
              Transforme suas gameplays
            </span>
            <span className="hero-h1-line">
              em <span style={{ color: "#FF6B35" }}>Reels virais</span>
            </span>
            <span className="hero-h1-line">
              em <span style={{ color: "#FF6B35" }}>segundos</span>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>.</span>
            </span>
          </h1>

          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxWidth: 600, margin: "0 auto 14px" }}>
            IA detecta seus melhores momentos, edita com cinematografia de Major, exporta em vertical. <strong style={{ color: "#E8E8F0", fontWeight: 700 }}>Sem CapCut, sem AllStar, sem editor manual.</strong>
          </p>

          {/* Sprint v5.7 (Mathieu 08/05/2026): "Render roda no seu
              Windows" + 4 stats chips (1v3 CLUTCH, DEFUSE, PLANT WON,
              ACE) removidos — "polui muito". Hero foca em: badge CS2,
              H1, descrição, CTA primary. STATS const mantida pq pode
              ser reusada em /pricing ou /how-it-works no futuro. */}
          <div style={{ marginBottom: 4 }} />

          <HeroCTA versionSuffix={versionSuffix} />
        </div>
      </section>

      {/* ── Demo + Features + Mapas (2-col split) ──────────────────────
          Left: video placeholder 9:16 (Sprint #3 wire quando Mathieu mandar MP4 →
            trocar por <video autoPlay muted loop playsInline> + <source src="<R2 url>" />)
          Right: features grid + map pool inline
          Mobile: collapse via grid auto-fit minmax 320px. */}
      <section style={{ padding: "0 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 32,
          alignItems: "center",
        }}>
          {/* LEFT — Video demo (06/05): reel ZyWoo Mirage Vitality vs
              GamerLegion (Major BLAST 2026 maio). Renderizado em v0.6.21+
              client após shipping de Sprint #6 (kill flash + bomb timer +
              soundtracks variadas) + intro/outro 5s/7s + Bug #14 V2 windowed.
              Vídeo final 1080x1920 vertical, 60fps, ~109s, 54 MB.
              Hosted em /public/ por simplicidade — TODO: migrar pra R2
              quando bandwidth da landing começar a importar (P2). */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/showcase-zywoo-mirage-poster.jpg"
              style={{
                aspectRatio: "9 / 16",
                width: "100%",
                maxWidth: 380,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                objectFit: "cover",
              }}
            >
              <source src="/showcase-zywoo-mirage.mp4" type="video/mp4" />
            </video>
          </div>

          {/* RIGHT — features grid + map pool */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Header sobre o features grid */}
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#FF6B35",
                marginBottom: 8,
                textTransform: "uppercase",
              }}>
                Cada reel inclui
              </div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: 0,
                lineHeight: 1.2,
              }}>
                Tudo o que faz parecer um reel de Major
              </h2>
            </div>

            {/* Features grid 2 colunas (3 rows × 2 cols) */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}>
              {features.map((feat) => (
                <div
                  key={feat.label}
                  style={{
                    padding: "14px 14px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                    textAlign: "center",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{feat.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{feat.label}</div>
                </div>
              ))}
            </div>

            {/* Map pool — tag + ícones inline */}
            <div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.25)",
                marginBottom: 12,
                textTransform: "uppercase",
              }}>
                Pool competitivo CS2
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {MAPS.map((m) => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 7,
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <img src={`/maps/${m.id}.png`} alt={m.name} width={38} height={38} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.06em" }}>{m.name.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FragReel AI — section nova (06/05, Mathieu spec):
          "Eu usaria ela inteira para valorizar a IA FragReel. Uma animação
          junto. Faça algo que impressione, explique como o sistema de
          pontuação escolhe as melhores kills e o player pode selecionar
          os que ele quiser."

          Design: timeline central animada + cards laterais com critérios
          de scoring + linha "você decide" reforçando agency do user.
          ui-ux-pro-max principles: SVG icons (não emoji), 150-300ms
          transitions, transform/opacity animations only. */}
      <section style={{ padding: "84px 24px", background: "linear-gradient(180deg, #0D0D1A 0%, #14142A 50%, #0D0D1A 100%)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
        {/* Ambient glow background */}
        <div aria-hidden style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 900, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,107,53,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(255,107,53,0.10)", border: "1px solid rgba(255,107,53,0.25)", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#FF6B35", letterSpacing: "0.12em", marginBottom: 18, textTransform: "uppercase" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
              FragReel AI Scorer
            </div>
            <h2 style={{ fontSize: "clamp(28px, 4.2vw, 44px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 14px", lineHeight: 1.1 }}>
              A IA escolhe seus <span style={{ color: "#FF6B35" }}>melhores momentos</span>.
              <br />
              <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>Você decide quais entram.</span>
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, maxWidth: 580, margin: "0 auto" }}>
              Cada kill, clutch, defuse e plant ganha um score baseado em dificuldade e impacto.
              Ranqueamos. Você cura.
            </p>
          </div>

          {/* Animated timeline + criteria — 2-col split */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, alignItems: "center" }}>

            {/* LEFT — Animated demo timeline */}
            <div style={{
              padding: 24,
              background: "rgba(13,13,26,0.7)",
              border: "1px solid rgba(255,107,53,0.18)",
              borderRadius: 16,
              backdropFilter: "blur(8px)",
              animation: "ai-glow-pulse 4s ease-in-out infinite",
            }}>
              {/* Mini-header simulando UI do app */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)" }}>ANALISANDO DEMO · MIRAGE</span>
                </div>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)", color: "rgba(255,255,255,0.35)" }}>Round 14 · 02:18</span>
              </div>

              {/* Timeline track — Sprint v5.7.3 (Mathieu spec):
                  "Faça essa animação na vertical". Container portrait
                  320×400, events stacked top→bottom, sweep bar
                  horizontal moving down, score floats right. */}
              <div style={{ position: "relative", height: 360, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                {/* Horizontal tick marks pra dar leitura de timeline vertical */}
                {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => (
                  <div
                    key={p}
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: `${p}%`,
                      height: 1,
                      background: "rgba(255,255,255,0.04)",
                    }}
                  />
                ))}

                {/* Scan sweep line horizontal — varre top→bottom */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 2,
                    background:
                      "linear-gradient(90deg, transparent 0%, #FF6B35 30%, #FF6B35 70%, transparent 100%)",
                    boxShadow: "0 0 16px rgba(255,107,53,0.8)",
                    animation: "ai-scan-sweep 6s linear infinite",
                  }}
                />

                {/* Event markers — agora stacked verticalmente. Cada evento
                    fica num row centrado horizontalmente, top: % position
                    no track. Score float aparece à DIREITA do badge. */}
                {[
                  { top: 14, label: "HS", color: "#FF6B35", score: "+8", delay: "0.6s" },
                  { top: 28, label: "2K", color: "#FF6B35", score: "+15", delay: "1.7s" },
                  { top: 44, label: "AWP", color: "#fbbf24", score: "+12", delay: "2.6s" },
                  { top: 62, label: "1v3", color: "#a78bfa", score: "+45", delay: "3.7s" },
                  { top: 82, label: "DEFUSE", color: "#34d399", score: "+25", delay: "4.8s" },
                ].map((ev) => (
                  <div
                    key={ev.top}
                    style={{
                      position: "absolute",
                      top: `${ev.top}%`,
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        padding: "5px 12px",
                        background: `${ev.color}22`,
                        border: `1px solid ${ev.color}`,
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        color: ev.color,
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                        animation: `ai-event-pop 6s ease-out ${ev.delay} infinite`,
                        opacity: 0,
                      }}
                    >
                      {ev.label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: ev.color,
                        fontFamily: "var(--font-mono, monospace)",
                        whiteSpace: "nowrap",
                        animation: `ai-score-float 6s ease-out ${ev.delay} infinite`,
                        opacity: 0,
                        pointerEvents: "none",
                        textShadow: `0 0 12px ${ev.color}`,
                      }}
                    >
                      {ev.score}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer status */}
              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  142 events detected
                </span>
                <span style={{ fontFamily: "var(--font-mono, monospace)" }}>top <span style={{ color: "#FF6B35", fontWeight: 700 }}>8</span> selected</span>
              </div>
            </div>

            {/* RIGHT — Scoring criteria cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 4 }}>
                Sistema de pontuação
              </div>

              {[
                { label: "1vN Clutch",      desc: "Última vida do time, vence o round", points: "+45", tone: "#a78bfa" },
                { label: "ACE",             desc: "5 kills · 1 round, sem assistência", points: "+50", tone: "#FF6B35" },
                { label: "Defuse / Plant",  desc: "Decide o round com a bomba",         points: "+25", tone: "#34d399" },
                { label: "Multi-kill",      desc: "2K, 3K, 4K · combo dentro de 5s",    points: "+15", tone: "#FF6B35" },
                { label: "AWP no-scope",    desc: "Estilo · raridade técnica",          points: "+12", tone: "#fbbf24" },
              ].map((c) => (
                <div
                  key={c.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    background: "rgba(26,26,46,0.7)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                    transition: "transform 200ms ease, border-color 200ms ease, background 200ms ease",
                  }}
                >
                  <div style={{
                    width: 56,
                    height: 36,
                    borderRadius: 8,
                    background: `${c.tone}18`,
                    border: `1px solid ${c.tone}55`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 13,
                    fontWeight: 900,
                    color: c.tone,
                    letterSpacing: "-0.02em",
                    flexShrink: 0,
                  }}>
                    {c.points}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E8E8F0", marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.35 }}>{c.desc}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 4, padding: "12px 14px", background: "rgba(255,107,53,0.08)", border: "1px dashed rgba(255,107,53,0.4)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
                  Você revê o ranking e <strong style={{ color: "#FF6B35" }}>marca/desmarca</strong> highlights antes de gerar o reel.
                </span>
              </div>
            </div>

          </div>

          {/* Bottom row — 4 quick-fact cards (Sprint v5.6 plataforma-style) */}
          <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {reasons.map((f) => (
              <div
                key={f.label}
                style={{
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#E8E8F0" }}>{f.label}</div>
                </div>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {steps.map((s) => (
              <div
                key={s.num}
                style={{
                  padding: "20px 18px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(255,107,53,0.10)",
                    border: "1px solid rgba(255,107,53,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 12,
                    marginBottom: 14,
                    color: "#FF6B35",
                    fontFamily: "monospace",
                  }}
                >
                  {s.num}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#E8E8F0" }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ad transparency — chip de fluxo + privacy (Sprint v5.6 platform-style) ─── */}
      <section style={{ padding: "60px 24px", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 20px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
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

      {/* ── FAQ — 06/05 (Mathieu spec): "Adicione um FAQ também no final".
          Native <details> tag pra accessibility (keyboard nav free, no JS).
          7 perguntas baseadas em dúvidas que aparecem em testes de campo. */}
      <section style={{ padding: "72px 24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#FF6B35", textTransform: "uppercase", marginBottom: 8 }}>
              FAQ
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
              Perguntas frequentes
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              {
                q: "Preciso enviar minha demo pra algum servidor?",
                a: "Não. O parsing da demo + render do reel rodam 100% no seu PC. Nada sai da sua máquina — o vídeo final fica direto na sua área de trabalho. O que vai pro servidor é só o evento de score (qual demo você analisou) pra estatísticas anônimas.",
              },
              {
                q: "Quanto tempo leva pra gerar um reel?",
                a: "Depende da demo e do PC. Tipicamente 5-15 minutos do clique ao MP4 pronto: ~5s parsing + ~2s ranking IA + ~3-10min CS2 capture + ~1-3min Remotion edit. Reels mobile (vertical) saem por volta dos 10min na maioria das máquinas.",
              },
              {
                q: "Como o FragReel difere do AllStar/CapCut?",
                a: "AllStar e CapCut são editores manuais — você corta, escolhe transições, adiciona música. FragReel é totalmente automático: a IA detecta clutches, ACEs, plants, defuses, multi-kills com base em parsing de tick-data da demo, ranqueia por score, e o editor Remotion monta o reel cinematográfico sozinho. Você escolhe quais highlights vão pro corte final, mas não precisa editar nada.",
              },
              {
                q: "Funciona com pro demos (HLTV, BLAST, FACEIT)?",
                a: "Sim. Coloque o .dem em ~/Downloads ou csgo/replays/ — FragReel detecta automaticamente. Importante: pro demos de torneios podem ter sido gravadas em build CS2 diferente do seu instalado. Se isso acontecer, o FragReel avisa em ~90s com mensagem clara.",
              },
              {
                q: "Por que precisa de Windows + CS2 instalado?",
                a: "Porque a captura do gameplay usa o próprio CS2 + HLAE (Half-Life Advanced Effects) pra renderizar a câmera POV do jogador. Sem CS2 rodando local, não tem como capturar o frame. Mac/Linux ainda não suportados.",
              },
              {
                q: "Posso escolher quais kills entram no reel?",
                a: "Sim. Depois do scoring automático, você vê o ranking dos highlights e marca/desmarca os que quer. O reel final usa só os marcados.",
              },
              {
                q: "É realmente grátis? Onde está o catch?",
                a: "Grátis e sem assinatura. Você assiste 1 anúncio de 30s antes de gerar cada reel — é o que sustenta o site. Sem upsell escondido, sem premium tier (por enquanto). Código open-source MIT, auditável no GitHub.",
              },
            ].map((item) => (
              <details
                key={item.q}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <summary style={{
                  cursor: "pointer",
                  padding: "16px 18px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#E8E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  listStyle: "none",
                  userSelect: "none",
                }}>
                  <span>{item.q}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, transition: "transform 200ms ease" }} className="faq-chevron">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </summary>
                <div style={{ padding: "0 18px 18px", fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                  {item.a}
                </div>
              </details>
            ))}
          </div>
          {/* Chevron rotation when details opens. Inline style restriction
              workaround via CSS string in <style> child. */}
          <style>{`
            details[open] .faq-chevron { transform: rotate(180deg); }
            details summary::-webkit-details-marker { display: none; }
          `}</style>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 24 }}>
          Pronto?
        </h2>
        <DownloadButton className="btn-primary" style={{ fontSize: 16, padding: "14px 36px" }}>
          ⬇ Baixar grátis{versionSuffix}
        </DownloadButton>
        <p style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          Windows 10/11 · CS2 instalado · Login Steam
        </p>
      </section>

      <footer style={{ padding: "32px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
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
