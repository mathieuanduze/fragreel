import Nav from "@/components/Nav";
import { getMatch } from "@/lib/api";
import MatchClient from "./MatchClient";
import AutoReanalyze from "./AutoReanalyze";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let match;
  try {
    match = await getMatch(id);
  } catch (e) {
    match = null;
    // Heurística pra distinguir:
    //   - getMatch throws "Render status not available" (genérico) → tratamos
    //     todos como "not_found" porque na prática 99% dos casos é Railway
    //     ephemeral storage que esqueceu o match após redeploy (Bug #10).
    //   - Network error real (server fora do ar) seria raro — Vercel/Railway
    //     têm uptime alto. AutoReanalyze trata ambos com mesmo flow.
    console.error(`getMatch(${id}) failed:`, e);
  }

  if (!match) {
    // Bug #10 fix V2 (28/04 — Mathieu pediu): em vez de mostrar tela
    // estática "precisa re-analisar + voltar à biblioteca" (fricção
    // de 3 cliques), AutoReanalyze faz tudo automático: invalida cache
    // local stale + re-upload pro server + redirect pro novo match_id.
    // Se algo falhar (client offline, demo deletada), AutoReanalyze
    // mostra o estado específico com botão "Voltar à biblioteca".
    return (
      <>
        <Nav />
        <AutoReanalyze staleMatchId={id} />
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
