import Link from "next/link";
import Nav from "@/components/Nav";
import { getMatch } from "@/lib/api";
import MatchClient from "./MatchClient";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let match;
  let errorKind: "not_found" | "api_offline" | null = null;
  try {
    match = await getMatch(id);
  } catch (e) {
    match = null;
    // Heurística pra distinguir:
    //   - getMatch throws "Render status not available" (genérico) → tratamos
    //     todos como "not_found" porque na prática 99% dos casos é Railway
    //     ephemeral storage que esqueceu o match após redeploy.
    //   - Network error real (server fora do ar) seria raro — Vercel/Railway
    //     têm uptime alto. Se acontecer, mensagem ainda faz sentido.
    errorKind = "not_found";
    console.error(`getMatch(${id}) failed:`, e);
  }

  if (!match) {
    // v0.3.1 (Bug #10 escalado): Railway storage é efêmero — cada redeploy
    // limpa data/matches/. Scanner local persiste match_id que vira stale.
    // Solução definitiva: migrar pra R2/S3 (Prioridade #5 do roadmap).
    // UX paliativo: explicar pro user + botão de re-analisar (volta à
    // library, user clica "Mapear plays" e re-upload acontece em ~15s).
    return (
      <>
        <Nav />
        <div style={{
          minHeight: "calc(100vh - 64px)",
          background: "#0D0D1A",
          color: "#E8E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            textAlign: "center",
            maxWidth: 540,
            background: "#131325",
            border: "1px solid #2D2D44",
            borderRadius: 12,
            padding: "40px 32px",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔄</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: "#E8E8F0" }}>
              Demo precisa ser re-analisada
            </h2>
            <p style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.65)",
              marginBottom: 24,
            }}>
              O FragReel está em beta e nosso servidor reseta os dados quando lançamos
              atualizações (acontece bastante nessa fase de desenvolvimento).
              <br /><br />
              <strong style={{ color: "#E8E8F0" }}>Tuas demos no PC estão intactas.</strong>{" "}
              Basta voltar à biblioteca, clicar &ldquo;Mapear jogadas de impacto&rdquo; na demo
              de novo e ela é re-analisada em ~15s.
            </p>
            <Link
              href="/library"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                background: "#FF6B35",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 8,
                textDecoration: "none",
                marginBottom: 12,
              }}
            >
              ← Voltar à biblioteca
            </Link>
            <div style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              marginTop: 16,
              fontFamily: "monospace",
            }}>
              match_id: {id.slice(0, 24)}...
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <MatchClient match={match} />
    </>
  );
}
