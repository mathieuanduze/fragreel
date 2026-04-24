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
// aqui faz o route ser statically generated com ISR de 5min — cached em
// 99%+ dos requests, só refreshing o upstream a cada 5min.
export const revalidate = 300;

export async function GET() {
  const data = await getLatestClientVersion();
  const status = data.latest ? 200 : 502;
  return Response.json(data, { status });
}
