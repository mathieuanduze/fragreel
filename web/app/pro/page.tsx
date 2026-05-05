/**
 * Sprint #5 (05/05) — Pro Demo Render
 *
 * Discovery page pra fluxo "render reel de pro player". Step-by-step:
 *   1. User baixa .dem de HLTV.org / CSGOStats.gg / outra fonte
 *   2. Coloca em <Steam>/steamapps/common/Counter-Strike Global Offensive/
 *      game/csgo/replays/
 *   3. Abre fragreel.gg/pro → lista TODAS .dem locais (não só matchmaking)
 *   4. Clica numa demo → /pro/[sha] → roster picker → render
 *
 * Diferença do /match/[id] flow:
 *   /match/[id]: assume user é player na demo (matchmaking history)
 *   /pro/[sha]:  user pode escolher QUALQUER player da roster (10 options)
 */
import Nav from "@/components/Nav";
import Link from "next/link";
import { Suspense } from "react";
import ProDemoListClient from "./ProDemoListClient";

export const metadata = {
  title: "FragReel · Render demo de pro player",
  description: "Renderize reels a partir de demos de pro players. Baixe a .dem de HLTV ou CSGOStats, escolha o jogador, gere o reel.",
};

export default function ProPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />

      <section style={{ paddingTop: 110, paddingBottom: 40, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="tag" style={{ marginBottom: 12 }}>Sprint #5</div>
          <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.025em", marginBottom: 16, lineHeight: 1.1 }}>
            Renderize qualquer demo,<br />
            <span style={{ color: "#FF6B35" }}>com qualquer player</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 560, margin: "0 auto 32px" }}>
            Não precisa ter jogado a partida. Baixe a demo, escolha o jogador, gere o reel.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            maxWidth: 720,
            margin: "0 auto 24px",
            textAlign: "left",
          }}>
            {[
              { num: "01", title: "Baixe a demo", desc: "HLTV.org, CSGOStats.gg ou direto do amigo" },
              { num: "02", title: "Coloca em replays/", desc: "Pasta padrão do CS2 (csgo/replays/)" },
              { num: "03", title: "Escolha o player", desc: "Roster da partida com kills + HS + side" },
              { num: "04", title: "Renderiza", desc: "POV do jogador escolhido, com edição completa" },
            ].map((s) => (
              <div key={s.num} style={{ padding: "14px 16px", background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#FF6B35", marginBottom: 4 }}>{s.num}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 8, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18, letterSpacing: "-0.01em" }}>
            Demos no seu PC
          </h2>
          <Suspense fallback={
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
              Carregando lista de demos...
            </div>
          }>
            <ProDemoListClient />
          </Suspense>
        </div>
      </section>

      <section style={{ padding: "40px 24px", textAlign: "center", borderTop: "1px solid #2D2D44" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 14 }}>
          Não tem demos pra testar?
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <a href="https://www.hltv.org/results" target="_blank" rel="noopener" className="btn-ghost" style={{ fontSize: 13 }}>
            Baixar de HLTV →
          </a>
          <a href="https://csgostats.gg/" target="_blank" rel="noopener" className="btn-ghost" style={{ fontSize: 13 }}>
            CSGOStats.gg →
          </a>
        </div>
      </section>

      <footer style={{ padding: "32px 24px", borderTop: "1px solid #2D2D44", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        <Link href="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>← FragReel home</Link>
      </footer>
    </div>
  );
}
