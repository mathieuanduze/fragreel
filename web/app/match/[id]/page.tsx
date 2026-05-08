import AppShell from "@/components/AppShell";
import { getMatch } from "@/lib/api";
import MatchClient from "./MatchClient";
import LocalMatchFetcher from "./LocalMatchFetcher";

/**
 * /match/[id] — Sprint v5.2 (08/05/2026 Mathieu spec):
 *   "Quando eu tô em /match, eu ainda preciso da sidebar pra navegar".
 *
 * Migrado de Nav top-bar antiga pra AppShell sidebar (consistente com
 * /matches /renders /report-bug). MatchClient renderiza dentro do
 * content area do AppShell.
 */
export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Estratégia hibrida (Sprint I.5 + Bug #10 V2):
  //   1. Server Component tenta Railway primeiro (CDN cache fast-path)
  //   2. Se Railway 200: renderiza MatchClient direto
  //   3. Se Railway 404: LocalMatchFetcher tenta cliente local (127.0.0.1:5775)
  //      → Bug #10 V2: cai pro AutoReanalyze se cliente também 404
  // Server Component não fala com 127.0.0.1 (Vercel ≠ user PC), por isso etapa 3 é Client.
  let match;
  try {
    match = await getMatch(id);
  } catch (e) {
    match = null;
    console.error(`getMatch(${id}) Railway falhou:`, e);
  }

  if (!match) {
    return (
      <AppShell title="Carregando partida..." subtitle="Buscando dados no servidor ou cliente local">
        <LocalMatchFetcher matchId={id} />
      </AppShell>
    );
  }

  const mapPretty =
    match.map.replace(/^de_/, "").charAt(0).toUpperCase() +
    match.map.replace(/^de_/, "").slice(1);

  return (
    <AppShell
      title={`Editar FragReel · ${mapPretty}`}
      subtitle={`${match.score} · ${match.date}`}
    >
      <MatchClient match={match} />
    </AppShell>
  );
}
