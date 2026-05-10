import { getLatestClientVersion } from "@/lib/server/getLatestClientVersion";

/**
 * GET /api/client-version
 *
 * Proxy pra `api.github.com/repos/:owner/:repo/releases/latest` com cache
 * server-side de 5 minutos. Existe pra que a web saiba qual a última versão
 * publicada do FragReel Windows .exe SEM precisar de hardcode em
 * `lib/version.ts` — o que forçava bump manual coordenado com a release.
 *
 * Por que o proxy em vez de chamar GitHub direto do browser:
 *   1. Rate limit do GitHub é 60 req/hora/IP sem auth. Cachear server-side
 *      agrega em 1 req / 5min no pior caso, independente de quantos users.
 *   2. Esconde o upstream — se o FragReel migrar pra outro host de release
 *      (ou self-hosted), só esse route muda, os componentes nem sabem.
 *   3. Normaliza o payload — só retorna o que a UI precisa.
 *
 * Lógica real fica em lib/server/getLatestClientVersion.ts pra ser
 * reutilizada também por Server Components (ex: app/page.tsx).
 *
 * Fallback: se a chamada falhar (rate limit, offline, repo privado,
 * API mudou shape), retorna 502 com `{ latest: null, error }`. O hook
 * client-side trata `null` como "sem info, não mostra banner de update",
 * que é o failure mode seguro — pior bloquear update que falsamente
 * pedir downgrade pro user.
 */

// Next 16 tornou GET handlers dinâmicos por padrão. Declarar revalidate
// aqui faz o route ser statically generated com ISR.
//
// Sprint v5.7.18 (Mathieu 09/05/2026 round 3): "ele sempre faz aparecer
// a versão anterior do client e só quando baixo ele aparece a mais nova".
// Causa: revalidate 300s = web pode mostrar latest 5min stale. Quando
// release nova sai (típico durante sprint ativa), banner aparece com
// versão N-1 enquanto download bypass cache pega N real.
//
// Bumped 300 → 60s. GitHub rate limit é 60req/h sem auth — 60s = 60req/h
// no pior caso (1 user contínuo), aceitável pra fase atual de tráfego
// baixo. Quando audiência crescer, migrar pra ETag-based revalidation
// (conditional GETs não consomem rate limit).
export const revalidate = 60;

export async function GET() {
  const data = await getLatestClientVersion();
  const status = data.latest ? 200 : 502;
  return Response.json(data, { status });
}
