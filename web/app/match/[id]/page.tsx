import Nav from "@/components/Nav";
import { getMatch } from "@/lib/api";
import MatchClient from "./MatchClient";
import LocalMatchFetcher from "./LocalMatchFetcher";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Estratégia hibrida (Sprint I.5 + Bug #10 V2):
  //
  // 1. Server Component tenta Railway primeiro
  //    → preserva SSR pra users com matches já uploadados pro Railway
  //    → response rápida em CDN cache hit
  //
  // 2. Se Railway 200: renderiza MatchClient direto (caminho atual)
  //
  // 3. Se Railway 404: renderiza <LocalMatchFetcher /> Client Component que:
  //    a. Tenta getLocalMatch(id) no cliente FragReel local (127.0.0.1:5775)
  //       → Sprint I.5: cliente salva match em ~/.fragreel/matches/ pós parse_and_score_locally
  //    b. Se cliente local TEM match: renderiza MatchClient com dados locais
  //    c. Se cliente local NÃO tem (404 ou offline): cai pro AutoReanalyze
  //       (Bug #10 V2 — força re-upload com cliente local)
  //
  // Server Component não pode falar com 127.0.0.1 (servidor Vercel ≠ user PC).
  // Por isso a etapa 3 vai pro Client Component.
  let match;
  try {
    match = await getMatch(id);
  } catch (e) {
    match = null;
    console.error(`getMatch(${id}) Railway falhou:`, e);
  }

  if (!match) {
    // Sprint I.5: Client Component vai checar cliente local + fallback AutoReanalyze
    return (
      <>
        <Nav />
        <LocalMatchFetcher matchId={id} />
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
