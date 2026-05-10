"use client";

import { useEffect, useState } from "react";

/**
 * Hook que retorna a última versão publicada do FragReel .exe (tag GitHub).
 *
 * Substitui a constante hardcoded `CLIENT_VERSION` em `lib/version.ts` —
 * o que forçava bump manual coordenado sempre que saía release nova.
 *
 * Fonte: `/api/client-version` (server-side proxy pro GitHub API, com
 * cache server de 5min). Esse hook aplica um SEGUNDO nível de cache no
 * browser — TTL 5min em module-level — pra que múltiplos componentes
 * que chamem `useLatestClientVersion()` no mesmo mount compartilhem
 * um único fetch em vez de cada um disparar o próprio.
 *
 * Retorno:
 *   - `latest: string | null` — tag tipo "v0.2.15", ou null se fetch falhou
 *   - `loading: boolean` — true no primeiro paint até resolver
 *   - `error: string | null` — última mensagem de erro (sticky até próximo sucesso)
 *
 * Failure mode: null + error. Callsites devem tratar null como "não sei
 * qual é a última" e NÃO mostrar banner de update (cautelosamente não
 * pede pro user atualizar sem ter certeza — pior UX seria rodar update
 * em loop por infiabilidade do GitHub API).
 */

interface LatestVersionResponse {
  latest: string | null;
  publishedAt?: string | null;
  htmlUrl?: string | null;
  error?: string;
}

export interface LatestClientVersion {
  latest: string | null;
  publishedAt: string | null;
  htmlUrl: string | null;
  loading: boolean;
  error: string | null;
}

// Sprint v5.7.18 (Mathieu 09/05/2026 round 3): bumped 5min → 60s.
// Era 5min casado com route revalidate=300, mas isso fazia o banner
// mostrar versão N-1 quando releases saíam em sequência rápida (sprint
// ativa). Agora 60s casa com route revalidate=60, máximo 1min de stale.
// UpdateRequiredModal também faz refreshLatestClientVersion() on mount
// pra garantir que CTA "Atualizar pra vX" mostra a vX real.
const TTL_MS = 60 * 1000;

type CacheEntry = {
  fetchedAt: number;
  data: LatestClientVersion;
};

let moduleCache: CacheEntry | null = null;
let inflight: Promise<LatestClientVersion> | null = null;
const subscribers = new Set<(v: LatestClientVersion) => void>();

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < TTL_MS;
}

async function fetchLatest(): Promise<LatestClientVersion> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/client-version", {
        // No-store no browser: o caching acontece no server-side (route
        // handler). Deixar o browser cachear também adiciona uma camada
        // que fica stale sem revalidação explícita — melhor sempre ir
        // no server e deixar ele decidir.
        cache: "no-store",
      });
      const body = (await res.json()) as LatestVersionResponse;

      const result: LatestClientVersion = {
        latest: body.latest ?? null,
        publishedAt: body.publishedAt ?? null,
        htmlUrl: body.htmlUrl ?? null,
        loading: false,
        error: body.latest ? null : (body.error ?? "unknown_error"),
      };

      moduleCache = { fetchedAt: Date.now(), data: result };
      subscribers.forEach((cb) => cb(result));
      return result;
    } catch (e) {
      const result: LatestClientVersion = {
        latest: null,
        publishedAt: null,
        htmlUrl: null,
        loading: false,
        error: (e as Error).message || "fetch_failed",
      };
      moduleCache = { fetchedAt: Date.now(), data: result };
      subscribers.forEach((cb) => cb(result));
      return result;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

const INITIAL: LatestClientVersion = {
  latest: null,
  publishedAt: null,
  htmlUrl: null,
  loading: true,
  error: null,
};

export function useLatestClientVersion(): LatestClientVersion {
  // Initializer lê cache module-level síncrono — se outro componente já
  // fez fetch nesta sessão (dentro do TTL), compartilha o resultado sem
  // disparar nova request e sem flash de "loading" na primeira render.
  const [state, setState] = useState<LatestClientVersion>(() =>
    isFresh(moduleCache) ? moduleCache.data : INITIAL,
  );

  useEffect(() => {
    let alive = true;

    const update = (v: LatestClientVersion) => {
      if (alive) setState(v);
    };
    subscribers.add(update);

    // Sem setState síncrono aqui — o initializer já cobriu o caso cache-hit.
    // Só disparamos fetch se o cache não está fresh, e o callback do fetch
    // é assíncrono (não cai na regra react-hooks/set-state-in-effect).
    if (!isFresh(moduleCache)) {
      fetchLatest().then((v) => {
        if (alive) setState(v);
      });
    }

    return () => {
      alive = false;
      subscribers.delete(update);
    };
  }, []);

  return state;
}

/**
 * Força refetch ignorando o cache TTL. Útil pra callsites que acabaram
 * de disparar um update e querem ver a nova versão refletida imediatamente.
 */
export async function refreshLatestClientVersion(): Promise<LatestClientVersion> {
  moduleCache = null;
  return fetchLatest();
}
