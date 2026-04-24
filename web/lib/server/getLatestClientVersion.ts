/**
 * Server-side fetch da última release do fragreel-client no GitHub.
 *
 * Convenção: arquivos sob `lib/server/` só devem ser importados por
 * Server Components ou Route Handlers. Não adicionamos `import
 * "server-only"` aqui porque o pacote não está instalado e a
 * função não acessa nenhum secret — só faz fetch de API pública.
 *
 * Usado por:
 *   - Route handler /api/client-version (que expõe isso pro browser)
 *   - Server Components (ex: app/page.tsx) que renderizam a versão
 *     direto no HTML sem precisar hidratar hook client
 *
 * Cache: 5min via fetch({ next: { revalidate: 300 } }). Next compartilha
 * esse cache entre chamadas do mesmo server instance, então múltiplos
 * Server Components que chamem isso no mesmo render compartilham 1 fetch.
 *
 * Failure mode: retorna `{ latest: null, error }` em qualquer falha
 * (rate limit 403, repo inexistente, JSON malformado, network). Callsites
 * devem tratar `latest === null` como "não sei, mostra placeholder" —
 * nunca travar a UI por causa dessa chamada.
 */

const GITHUB_API =
  "https://api.github.com/repos/mathieuanduze/fragreel-client/releases/latest";

export interface LatestRelease {
  latest: string | null;
  publishedAt: string | null;
  htmlUrl: string | null;
  error?: string;
}

export async function getLatestClientVersion(): Promise<LatestRelease> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "fragreel-web",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return {
        latest: null,
        publishedAt: null,
        htmlUrl: null,
        error: `github_api_${res.status}`,
      };
    }

    const data = (await res.json()) as {
      tag_name?: string;
      published_at?: string;
      html_url?: string;
    };

    if (!data.tag_name) {
      return {
        latest: null,
        publishedAt: null,
        htmlUrl: null,
        error: "github_api_no_tag",
      };
    }

    return {
      latest: data.tag_name,
      publishedAt: data.published_at ?? null,
      htmlUrl: data.html_url ?? null,
    };
  } catch (e) {
    return {
      latest: null,
      publishedAt: null,
      htmlUrl: null,
      error: (e as Error).message || "fetch_failed",
    };
  }
}
