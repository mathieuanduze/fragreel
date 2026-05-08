/**
 * Sprint #7 (05/05) — Unified flow: roster picker pra qualquer demo.
 *
 * Substitui /pro/[sha] (que vira deprecated). Mesma lógica de roster picker
 * mas integrado ao fluxo principal /library → /demo/[sha].
 *
 * Próximas phases (7.3+): clicar player no roster → Ad 30s → score com
 * target_steamid → highlights → user picks → "Gerar FragReel" → Ad → render.
 *
 * Phase 7.2 atual MVP: roster picker visual + intent stash (placeholder).
 */
import Nav from "@/components/Nav";
import Link from "next/link";
import DemoRosterClient from "./DemoRosterClient";

interface Props {
  params: Promise<{ sha: string }>;
}

export const metadata = {
  title: "FragReel · Escolha o player",
};

export default async function DemoPage({ params }: Props) {
  const { sha } = await params;

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />
      <section style={{ paddingTop: 90, paddingBottom: 60, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <Link
            href="/matches"
            style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
          >
            ← Voltar pras demos
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 16, marginBottom: 8 }}>
            Escolha o player
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 32 }}>
            Roster da partida ordenado por kills. Clique num player pra renderizar a
            perspectiva dele — incluindo você mesmo se você jogou nessa partida.
          </p>
          <DemoRosterClient sha={sha} />
        </div>
      </section>
    </div>
  );
}
