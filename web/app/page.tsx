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

const steps = [
  { num: "01", title: "Baixe o client",      desc: "FragReel.exe para Windows. Tudo incluído (Node + editor + ffmpeg). Login com Steam uma vez só." },
  { num: "02", title: "Abra a Biblioteca",   desc: "O client detecta as demos que o CS2 já salva no seu PC. Sem upload manual, sem OBS." },
  { num: "03", title: "Escolha a partida",   desc: "Clique numa partida — o scoring identifica clutches, defuses, plants e ACEs automaticamente." },
  { num: "04", title: "1 ad, vídeo pronto",  desc: "Você assiste 1 anúncio de 30s enquanto o reel renderiza no seu PC. MP4 final salvo no Desktop." },
];

const outputs = [
  {
    icon: "🎬",
    label: "Highlights Reel",
    format: "9:16 vertical OU 16:9 horizontal · 60-80s",
    desc: "3 melhores momentos da partida em sequência. Scoreboard ao vivo (CT vs T + HP), killfeed sincronizado, plant/defuse com notificações nativas do CS2, transições cinematográficas. Você escolhe a orientação por partida.",
    dest: "Vertical: TikTok · Reels · Shorts · WhatsApp  |  Horizontal: YouTube · Twitch",
  },
];

// Server Component async: pega a última versão publicada no GitHub pra
// exibir nos CTAs de download. Fetch server-side tem cache de 5min, então
// esta page só re-renderiza a cada 5min no ISR do Next.
export default async function Home() {
  // `latest` pode ser null se a API do GitHub estiver indisponível no
  // momento do build/revalidate. Os CTAs abaixo têm fallback gracioso
  // — nunca mostram string vazia, só omitem o sufixo de versão.
  const { latest } = await getLatestClientVersion();
  const versionSuffix = latest ? ` · ${latest}` : "";
  const versionLabel = latest ? ` · Última versão ${latest}` : "";
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 130, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }}>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "6px 14px", background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "#FF6B35", letterSpacing: "0.03em" }}>
            <img src="/cs2-icon.png" alt="CS2" width={20} height={20} style={{ borderRadius: 4, objectFit: "cover" }} />
            Counter-Strike 2 · Exclusivo
          </div>

          <h1 style={{ fontSize: "clamp(40px, 6.5vw, 76px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 24 }}>
            Seus frags com{" "}
            <span style={{ color: "#FF6B35" }}>cinematografia</span>
            <br />
            de Major.{" "}
            <span style={{ color: "rgba(255,255,255,0.3)" }}>De graça.</span>
          </h1>

          <p style={{ fontSize: 19, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 580, margin: "0 auto 16px" }}>
            O client lê as demos que o CS2 já salva no seu PC. Você escolhe a partida,
            o scoring identifica os <b style={{ color: "rgba(255,255,255,0.8)" }}>melhores clutches, plants e defuses</b> e
            renderiza um reel <b style={{ color: "rgba(255,255,255,0.8)" }}>vertical (TikTok/Reels) ou horizontal (YouTube/Twitch)</b> pronto pra postar — direto no seu PC, sem upload.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 36 }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ padding: "5px 12px", background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.color, letterSpacing: "0.04em" }}>{s.label}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{s.sub}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/download" download="FragReel.exe" className="btn-primary" style={{ fontSize: 16, padding: "14px 32px", textDecoration: "none" }}>
              ⬇ Baixar client · Windows{versionSuffix}
            </a>
            <Link href="/login" className="btn-ghost" style={{ fontSize: 16 }}>
              Entrar com Steam →
            </Link>
          </div>

          <p style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            Windows 10/11 · ~450 MB (tudo incluído) · Login com Steam · Sem assinatura{versionLabel}
          </p>
        </div>
      </section>

      {/* ── Mapas suportados ───────────────────────────────────────── */}
      <section style={{ padding: "0 24px 72px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", marginBottom: 20, textTransform: "uppercase" }}>
          Todos os mapas do pool competitivo
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {MAPS.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", background: "#16213E", border: "1px solid #2D2D44" }}>
                <img src={`/maps/${m.id}.png`} alt={m.name} width={56} height={56} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{m.name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── O que você recebe ──────────────────────────────────────── */}
      <section style={{ padding: "72px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="tag" style={{ textAlign: "center", marginBottom: 12 }}>O que você recebe</div>
        <h2 style={{ textAlign: "center", fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Reel pronto pra postar — vertical ou horizontal
        </h2>
        <p style={{ textAlign: "center", fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 48 }}>
          1 reel por partida. Você escolhe a orientação. 1 anúncio de 30s pra renderizar. Sem assinatura, sem taxa.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: outputs.length === 1 ? "minmax(0, 520px)" : "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, justifyContent: "center" }}>
          {outputs.map((o) => (
            <div key={o.label} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 32 }}>{o.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{o.label}</div>
                <div style={{ fontSize: 12, color: "#FF6B35", fontWeight: 600, marginBottom: 8 }}>{o.format}</div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{o.desc}</p>
              </div>
              <div style={{ marginTop: "auto", padding: "8px 12px", background: "#1A1A2E", borderRadius: 6, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {o.dest}
              </div>
            </div>
          ))}
        </div>

        {/* Mini features grid — Round 4c polish features */}
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { icon: "🎯", label: "Scoreboard ao vivo",     sub: "CT vs T + HP em tempo real" },
            { icon: "💀", label: "Killfeed sintético",      sub: "Stack do round todo, top-right" },
            { icon: "💣", label: "Plant + Defuse",          sub: "Notificações nativas CS2 visíveis" },
            { icon: "🎵", label: "4 trilhas de mood",       sub: "Ação · Heroico · Eletrônica · Chill" },
            { icon: "🔇", label: "Sem música? Toggle",      sub: "Pra YouTube agressivo com copyright" },
            { icon: "👁", label: "X-ray opcional",          sub: "Wallhack visual estilo HLTV" },
          ].map((feat) => (
            <div key={feat.label} style={{ padding: "12px 14px", background: "#16213E", border: "1px solid #2D2D44", borderRadius: 8 }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{feat.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#E8E8F0", marginBottom: 2 }}>{feat.label}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{feat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Por que FragReel ───────────────────────────────────────── */}
      <section style={{ padding: "72px 24px", background: "#1A1A2E", borderTop: "1px solid #2D2D44", borderBottom: "1px solid #2D2D44" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div className="tag" style={{ marginBottom: 12 }}>Por que FragReel?</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 40 }}>
            Feito pra jogador de CS2.<br />
            <span style={{ color: "rgba(255,255,255,0.35)" }}>Não pra todo mundo.</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
            {[
              { label: "Sem upload manual, sem OBS",        sub: "O client lê localmente as demos que o CS2 já salva no seu PC. Você só clica." },
              { label: "Render 100% local",                  sub: "HLAE + ffmpeg + Remotion empacotados no .exe. Seu vídeo nunca sai do seu computador." },
              { label: "Scoring de plays cinematográficas", sub: "Clutches 1vN, defuses, plants, ACEs, multi-kills, low-HP, no-scopes — priorização HLTV-style." },
              { label: "100% gratuito + open source",        sub: "Sustentado por ads no site. Código MIT auditável. Sem assinatura, sem dark patterns." },
            ].map((f) => (
              <div key={f.label} style={{ padding: "18px 20px", background: "#0D0D1A", border: "1px solid #2D2D44", borderRadius: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "#FF6B35" }}>✓ {f.label}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="tag" style={{ textAlign: "center", marginBottom: 12 }}>Como funciona</div>
          <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 52 }}>
            Do fim da partida ao vídeo pronto
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32 }}>
            {steps.map((s) => (
              <div key={s.num}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, marginBottom: 16, color: "white" }}>
                  {s.num}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ad transparency ────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <div className="tag" style={{ marginBottom: 12 }}>Por que é grátis</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>O anúncio é o tempo de renderização</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 28 }}>
          Renderizar o reel leva ~15-20 minutos no seu PC (HLAE captura + ffmpeg encode + Remotion edit).
          Enquanto isso acontece, você assiste <b style={{ color: "rgba(255,255,255,0.8)" }}>1 anúncio de 30 segundos</b> que sustenta os custos do site
          (servidor, parser, distribuição). Sem assinatura. Sem surpresa.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "14px 22px", background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 12, fontSize: 13, color: "rgba(255,255,255,0.45)", flexWrap: "wrap", justifyContent: "center" }}>
          <span>🎮 Jogue</span>
          <span style={{ color: "#2D2D44" }}>→</span>
          <span>📂 Demo salva pelo CS2</span>
          <span style={{ color: "#2D2D44" }}>→</span>
          <span>📺 Assista 30s de ad</span>
          <span style={{ color: "#2D2D44" }}>→</span>
          <span style={{ color: "#FF6B35", fontWeight: 700 }}>🎬 MP4 no Desktop</span>
        </div>

        <div style={{ marginTop: 22, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          🔒 Suas demos e vídeos nunca saem do seu PC. Só metadata anônima da partida (kill ticks, score, mapa) vai pro servidor pra fazer o scoring.{" "}
          <Link href="/privacy" style={{ color: "#FF6B35", textDecoration: "none", borderBottom: "1px dotted #FF6B35" }}>Política de Privacidade</Link>.
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px", textAlign: "center", borderTop: "1px solid #2D2D44" }}>
        <h2 style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Pronto para se sentir um pro?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 32, fontSize: 15 }}>
          Baixe o client. Jogue uma partida. Compartilhe seus melhores momentos.
        </p>
        <a href="/download" download="FragReel.exe" className="btn-primary" style={{ fontSize: 16, padding: "14px 36px", textDecoration: "none" }}>
          ⬇ Baixar client · Grátis{versionSuffix}
        </a>
        <p style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          Windows 10/11 · Requer Counter-Strike 2 instalado · Login com Steam obrigatório{versionLabel}
        </p>
      </section>

      <footer style={{ padding: "32px 24px", borderTop: "1px solid #2D2D44", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
          <Link href="/privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Privacidade</Link>
          <a href="https://github.com/mathieuanduze/fragreel-client" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>GitHub (client)</a>
          <a href="https://github.com/mathieuanduze/fragreel" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>GitHub (site)</a>
          <a href="https://signpath.org/foundation" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Code signing por SignPath</a>
        </div>
        <div>FragReel · 2026 · Open source MIT · Não afiliado à Valve Corporation</div>
      </footer>
    </div>
  );
}
