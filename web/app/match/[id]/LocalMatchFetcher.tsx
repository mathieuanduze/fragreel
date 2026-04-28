"use client";

/**
 * LocalMatchFetcher — Sprint I.5 (28/04 noite).
 *
 * Server Component `/match/[id]/page.tsx` tenta Railway primeiro (preserva SSR
 * pra users com matches no Railway). Quando Railway retorna 404 (Bug #10
 * Railway storage ephemeral OU Sprint I.5 match nunca subiu pro Railway),
 * renderiza esse Client Component que:
 *
 *   1. Tenta `getLocalMatch(id)` em 127.0.0.1:5775 (cliente FragReel local)
 *      - Sprint I.5: cliente parseia local + scora API + salva
 *        em ~/.fragreel/matches/<id>.json
 *   2. Se sucesso: renderiza MatchClient com match_doc local (sem Railway)
 *   3. Se 404 local TAMBÉM: cai pro AutoReanalyze (Bug #10 V2 fluxo existente)
 *      - AutoReanalyze faz cliente trigger re-upload (force=true)
 *
 * Browser security: Server Component não pode falar com 127.0.0.1 do user
 * (servidor Vercel ≠ máquina do user). Por isso esse componente é Client
 * Component — roda no browser que TEM acesso a 127.0.0.1:5775.
 */

import { useEffect, useState } from "react";
import {
  getLocalMatch,
  LocalClientOffline,
} from "@/lib/local";
import type { MatchOut } from "@/lib/api";
import MatchClient from "./MatchClient";
import AutoReanalyze from "./AutoReanalyze";

type Phase =
  | "checking_local" // tentando GET /matches/{id} no cliente local
  | "found_local"    // sucesso, match veio do cliente
  | "not_in_local"   // cliente respondeu mas sem esse match → AutoReanalyze
  | "client_offline"; // cliente FragReel não tá rodando → AutoReanalyze (que mostra erro próprio)

interface Props {
  matchId: string;
}

export default function LocalMatchFetcher({ matchId }: Props) {
  const [phase, setPhase] = useState<Phase>("checking_local");
  const [localMatch, setLocalMatch] = useState<MatchOut | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const match = await getLocalMatch(matchId);
        if (cancelled) return;
        if (match) {
          setLocalMatch(match);
          setPhase("found_local");
        } else {
          // Cliente respondeu mas não tem match → AutoReanalyze flow
          setPhase("not_in_local");
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof LocalClientOffline) {
          setPhase("client_offline");
        } else {
          // Erro inesperado — cai pra AutoReanalyze que tem failure modes
          console.error(`LocalMatchFetcher: ${e}`);
          setPhase("not_in_local");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  if (phase === "checking_local") {
    return (
      <div
        style={{
          minHeight: "calc(100vh - 64px)",
          background: "#0D0D1A",
          color: "rgba(255,255,255,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        Verificando match no FragReel local…
      </div>
    );
  }

  if (phase === "found_local" && localMatch) {
    return <MatchClient match={localMatch} />;
  }

  // Fallthrough: AutoReanalyze cobre client_offline + not_in_local com
  // suas próprias UIs específicas.
  return <AutoReanalyze staleMatchId={matchId} />;
}
