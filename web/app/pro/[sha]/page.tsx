import Nav from "@/components/Nav";
import Link from "next/link";
import ProRosterClient from "./ProRosterClient";

interface Props {
  params: Promise<{ sha: string }>;
}

export const metadata = {
  title: "FragReel · Escolha o player",
};

export default async function ProDemoPage({ params }: Props) {
  const { sha } = await params;

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />
      <section style={{ paddingTop: 90, paddingBottom: 60, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <Link
            href="/pro"
            style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
          >
            ← Voltar
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 16, marginBottom: 8 }}>
            Escolha o player
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 32 }}>
            Roster da partida ordenado por kills. Click em um player pra renderizar a perspectiva dele.
          </p>
          <ProRosterClient sha={sha} />
        </div>
      </section>
    </div>
  );
}
