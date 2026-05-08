"use client";

/**
 * Auto-reanalyze quando match_id está stale no servidor.
 *
 * Bug #10 (Railway storage ephemeral) UX V2 — Mathieu reportou 28/04 que a
 * tela "Demo precisa ser re-analisada + Voltar à biblioteca" é fricção
 * desnecessária: o client local TEM o .dem file, então o frontend pode
 * re-disparar o upload sozinho.
 *
 * Fluxo:
 *   1. Mount → busca demos no client local (127.0.0.1:5775)
 *   2. Acha demo com match_id === id da URL → pega sha
 *   3. Dispara POST /demos/<sha>/upload → re-analyze
 *   4. Polla GET /jobs/<sha> a cada 1s até event === "done"
 *   5. Server retorna novo match_id → router.push(`/match/<novo>`)
 *
 * Failure modes (todos com botão "Voltar à biblioteca" visível):
 *   - Client local fechado (LocalClientOffline) → "Abra o FragReel"
 *   - Demo não está na library local (foi deletada do PC) → "Demo não encontrada"
 *   - Re-analyze deu erro no server → mostra mensagem do server
 *   - Timeout 60s → "Servidor demorou demais — tenta de novo"
 *
 * Design: animação clara mostrando progresso (re-uploading → analyzing).
 * NUNCA fica "stuck" silenciosamente — heartbeat textual com elapsed seconds
 * (mesma lição de Bug #15).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getLocalDemos,
  triggerLocalUpload,
  getLocalJob,
  LocalClientOffline,
} from "@/lib/local";

type Phase =
  | "looking_up"      // procurando sha pelo match_id
  | "uploading"        // POST /demos/<sha>/upload disparado
  | "analyzing"        // pollando job, aguardando done
  | "done"             // sucesso, prestes a redirect
  | "client_offline"   // FragReel não tá rodando
  | "demo_not_found"   // não achou demo no scanner local
  | "error";           // outro erro

interface Props {
  staleMatchId: string;
}

export default function AutoReanalyze({ staleMatchId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("looking_up");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAt = useState(() => Date.now())[0];

  // Heartbeat de elapsed seconds — feedback visual mesmo durante operações
  // longas (Bug #15 lesson — silêncio é sintoma de bug).
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;
    let pollHandle: ReturnType<typeof setTimeout> | null = null;

    async function run() {
      try {
        // 1. Busca demo no scanner local pra achar sha pelo match_id
        const { matches } = await getLocalDemos(false);
        if (cancelled) return;

        const demo = matches.find((d) => d.match_id === staleMatchId);
        if (!demo) {
          // Pode ser que o scanner ainda não viu — refresh forçado
          const refreshed = await getLocalDemos(true);
          if (cancelled) return;
          const demoRetry = refreshed.matches.find((d) => d.match_id === staleMatchId);
          if (!demoRetry) {
            setPhase("demo_not_found");
            return;
          }
          await triggerAndPoll(demoRetry.sha1);
        } else {
          await triggerAndPoll(demo.sha1);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof LocalClientOffline) {
          setPhase("client_offline");
        } else {
          setPhase("error");
          setErrorMsg((e as Error).message ?? "Erro desconhecido");
        }
      }
    }

    async function triggerAndPoll(sha: string) {
      setPhase("uploading");
      // force=true: invalida cache local de match_id (Bug #10 fix V2).
      // Sem isso, local client retorna match_id antigo INSTANT em vez de
      // re-uploadear pro server, perpetuando o ciclo de erro.
      const job = await triggerLocalUpload(sha, { force: true });
      if (cancelled) return;

      // Cache hit do client local: pode estar "done" instant. Se não, pollar.
      if (job.event === "done" && job.match_id) {
        setPhase("done");
        router.push(`/match/${job.match_id}`);
        return;
      }
      if (job.event === "failed") {
        setPhase("error");
        setErrorMsg(job.error ?? job.reason ?? "upload failed");
        return;
      }

      setPhase("analyzing");

      // Poll com timeout 60s. Cada 1s.
      const POLL_INTERVAL_MS = 1000;
      const TIMEOUT_MS = 60_000;
      const pollStart = Date.now();

      const poll = async () => {
        if (cancelled) return;
        if (Date.now() - pollStart > TIMEOUT_MS) {
          setPhase("error");
          setErrorMsg("Servidor demorou mais de 60s — tente de novo na biblioteca.");
          return;
        }
        try {
          const j = await getLocalJob(sha);
          if (cancelled) return;
          if (!j) {
            // Job sumiu da queue antes de done — strange, retry
            pollHandle = setTimeout(poll, POLL_INTERVAL_MS);
            return;
          }
          if (j.event === "done" && j.match_id) {
            setPhase("done");
            router.push(`/match/${j.match_id}`);
            return;
          }
          if (j.event === "failed") {
            setPhase("error");
            setErrorMsg(j.error ?? j.reason ?? "analyze failed");
            return;
          }
          // queued / uploading / skipped → continua pollando
          pollHandle = setTimeout(poll, POLL_INTERVAL_MS);
        } catch (e) {
          if (cancelled) return;
          if (e instanceof LocalClientOffline) {
            setPhase("client_offline");
          } else {
            setPhase("error");
            setErrorMsg((e as Error).message ?? "Erro desconhecido");
          }
        }
      };
      poll();
    }

    run();

    return () => {
      cancelled = true;
      if (pollHandle) clearTimeout(pollHandle);
    };
  }, [staleMatchId, router]);

  // ── UI ────────────────────────────────────────────────────────────────────

  const heading =
    phase === "looking_up"
      ? "Procurando demo no FragReel local…"
      : phase === "uploading"
      ? "Re-enviando demo pro servidor…"
      : phase === "analyzing"
      ? "Re-analisando jogadas de impacto…"
      : phase === "done"
      ? "Pronto! Abrindo highlights…"
      : phase === "client_offline"
      ? "FragReel não está rodando"
      : phase === "demo_not_found"
      ? "Demo não encontrada no PC"
      : "Erro ao re-analisar";

  // Sub-text contextual por fase. Bug #19 (28/04 — Mathieu reportou):
  // copy "isso leva ~15s" mentia (real ficou em 47-60s). Removida promessa
  // rígida — agora cada fase explica o que está fazendo, sem ETA falso.
  // Range honesto: depends on demo size (50-200MB) + connection + server load.
  const sub =
    phase === "looking_up"
      ? `Localizando demo no scanner local… (${elapsedSec}s)`
      : phase === "uploading"
      ? `Enviando demo pro servidor (50-200MB dependendo da partida)… (${elapsedSec}s)`
      : phase === "analyzing"
      ? `Servidor está parseando eventos da partida e calculando highlights. Pode levar 30s a 2min dependendo do tamanho da demo. (${elapsedSec}s)`
      : phase === "done"
      ? "Redirecionando…"
      : phase === "client_offline"
      ? "Abra o FragReel no PC e tente de novo. Quando o ícone aparecer na bandeja, clique no botão abaixo."
      : phase === "demo_not_found"
      ? "Esta demo pode ter sido deletada da sua pasta de demos. Volte à biblioteca pra ver as demos disponíveis."
      : (errorMsg ?? "Tente de novo na biblioteca.");

  const isWorking = phase === "looking_up" || phase === "uploading" || phase === "analyzing";

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        background: "#0D0D1A",
        color: "#E8E8F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 540,
          background: "#131325",
          border: "1px solid #2D2D44",
          borderRadius: 12,
          padding: "40px 32px",
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16 }}>
          {phase === "done" ? "✅" : isWorking ? "🔄" : "⚠️"}
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 12,
            color: "#E8E8F0",
          }}
        >
          {heading}
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.65)",
            marginBottom: 24,
          }}
        >
          {sub}
        </p>

        {isWorking && (
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              margin: "0 auto 24px",
              height: 6,
              background: "#1A1A2E",
              borderRadius: 999,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent, #FF6B35, transparent)",
                animation: "fragreel-loading 1.5s linear infinite",
                width: "30%",
              }}
            />
            <style>{`
              @keyframes fragreel-loading {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(380%); }
              }
            `}</style>
          </div>
        )}

        {!isWorking && phase !== "done" && (
          <Link
            href="/matches"
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
        )}

        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            marginTop: 16,
            fontFamily: "monospace",
          }}
        >
          match_id stale: {staleMatchId.slice(0, 24)}…
        </div>
      </div>
    </div>
  );
}
