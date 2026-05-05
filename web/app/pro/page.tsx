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

      <section style={{ paddingTop: 110, paddingBottom: 30, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h1 style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-0.025em", marginBottom: 14, lineHeight: 1.1 }}>
            Suas demos,{" "}
            <span style={{ color: "#FF6B35" }}>qualquer player</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 580, margin: "0 auto 24px" }}>
            Renderize reels a partir das suas partidas do CS2 — ou escolha qualquer jogador
            de uma demo de pro player que você baixou.
          </p>

          {/* 2 fontes de demos — clarifica que TODAS aparecem na lista abaixo */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            maxWidth: 720,
            margin: "0 auto",
            textAlign: "left",
          }}>
            <div style={{
              padding: "14px 16px",
              background: "#1A1A2E",
              border: "1px solid #2D2D44",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#4CAF82", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                ✓ Automático
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Suas partidas do CS2</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                O CS2 já salva as demos das suas partidas competitivas em <code style={{ color: "#FF6B35", fontSize: 11 }}>csgo/replays/</code>.
                FragReel detecta automaticamente — não precisa fazer nada.
              </div>
            </div>
            <div style={{
              padding: "14px 16px",
              background: "#1A1A2E",
              border: "1px solid #2D2D44",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                ⬇ Manual
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Demos de pro players</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                Baixe .dem de <a href="https://www.hltv.org/results" target="_blank" rel="noopener" style={{ color: "#FF6B35" }}>HLTV.org</a> ou <a href="https://csgostats.gg/" target="_blank" rel="noopener" style={{ color: "#FF6B35" }}>CSGOStats.gg</a> e drop em <code style={{ color: "#FF6B35", fontSize: 11 }}>csgo/replays/</code>.
                Escolha NiKo, donk, ZywOo — qualquer player do roster.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 8, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.01em" }}>
            Demos disponíveis
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 18 }}>
            Suas partidas do CS2 + qualquer .dem que você baixou e colocou em <code style={{ color: "#FF6B35", fontSize: 12 }}>csgo/replays/</code>.
          </p>
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
