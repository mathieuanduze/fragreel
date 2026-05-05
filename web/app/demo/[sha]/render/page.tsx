/**
 * Sprint #7 Phase 7.3-7.5 (05/05) — fluxo unified Pro Demo Render.
 *
 * Reusa MatchClient (que tem todo o flow de highlights selection + mood +
 * 5 toggles + AdModal + render trigger). Diferença: passa targetSteamid +
 * targetName overrides pra que HLAE renderize a perspectiva de OUTRO player
 * (não o user logado).
 *
 * Server-side: chama /demos/<sha>/score com target_steamid → match_doc no
 * schema de MatchOut → passa pra MatchClient como initialMatch.
 *
 * Pendente UX (Phase 7.6): Ad enquanto score roda (5-15s parse + score).
 * Hoje user vê loading text. Sprint dedicada futura.
 */
import Nav from "@/components/Nav";
import Link from "next/link";
import DemoRenderLoader from "./DemoRenderLoader";

interface Props {
  params: Promise<{ sha: string }>;
  searchParams: Promise<{ steamid?: string; name?: string }>;
}

export const metadata = {
  title: "FragReel · Gerando reel",
};

export default async function DemoRenderPage({ params, searchParams }: Props) {
  const { sha } = await params;
  const { steamid, name } = await searchParams;

  if (!steamid) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
        <Nav />
        <section style={{ paddingTop: 110, paddingBottom: 60, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 500, margin: "0 auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
              Player não especificado
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
              Volta pra escolher quem vai protagonizar o reel.
            </p>
            <Link href={`/demo/${sha}`} className="btn-primary" style={{ padding: "10px 24px", textDecoration: "none" }}>
              ← Voltar pro roster
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />
      <DemoRenderLoader
        sha={sha}
        targetSteamid={steamid}
        targetName={name ?? `Player ${steamid.slice(-6)}`}
      />
    </div>
  );
}
