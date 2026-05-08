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
import AdSlot from "@/components/AdSlot";
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

  // Sprint v5.7 (08/05/2026 Mathieu spec): "Re-analisando jogadas de
  // impacto" copy era confuso e datado. Renomeado pra match terminologia
  // do AnalyzingDemoModal usado em /matches.
  const heading =
    phase === "looking_up"
      ? "Localizando demo no PC…"
      : phase === "uploading"
      ? "Re-enviando demo pra análise…"
      : phase === "analyzing"
      ? "Analisando demo…"
      : phase === "done"
      ? "Pronto! Abrindo highlights…"
      : phase === "client_offline"
      ? "FragReel não está rodando"
      : phase === "demo_not_found"
      ? "Demo não encontrada no PC"
      : "Erro ao analisar";

  const sub =
    phase === "looking_up"
      ? `Procurando o arquivo .dem no scanner local… (${elapsedSec}s)`
      : phase === "uploading"
      ? `Enviando demo pra análise (50-200MB dependendo da partida)… (${elapsedSec}s)`
      : phase === "analyzing"
      ? `IA está processando rounds, kills e jogadas de impacto. Pode levar 30s a 2min dependendo do tamanho da demo. (${elapsedSec}s)`
      : phase === "done"
      ? "Redirecionando…"
      : phase === "client_offline"
      ? "Abra o FragReel no PC e tente de novo. Quando o ícone aparecer na bandeja, clique no botão abaixo."
      : phase === "demo_not_found"
      ? "Esta demo pode ter sido deletada da pasta de replays/. Volte pra Minhas Demos e selecione outra — ou importe novamente via 'Importar .dem'."
      : (errorMsg ?? "Tente de novo a partir de Minhas Demos.");

  const isWorking = phase === "looking_up" || phase === "uploading" || phase === "analyzing";

  // Sprint v5.7.2 (Mathieu spec 08/05/2026):
  //   "o problema da página reanalizando, é que ela deveria ser somente
  //    a página que fala que ta analizando, com o ad lá"
  //
  // Quando working: render AnalyzingDemoView-style layout (mesmo visual
  // do AnalyzingDemoModal usado em /matches expand inline) com:
  //   - Headline "Analisando demo" destacada
  //   - Step rotation (lendo .dem → identificando jogadas...)
  //   - AdSlot leaderboard ("Patrocinado · enquanto a IA trabalha")
  //   - Indeterminate progress bar
  // Quando error/done: card pequeno com ação.

  if (isWorking) {
    return <AnalyzingDemoView phase={phase} elapsedSec={elapsedSec} />;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        minHeight: "60vh",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 540,
          width: "100%",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          padding: "36px 32px",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 18px",
            borderRadius: 14,
            background:
              phase === "done"
                ? "rgba(91,227,143,0.10)"
                : "rgba(255,107,53,0.08)",
            border: `1px solid ${
              phase === "done"
                ? "rgba(91,227,143,0.30)"
                : "rgba(255,107,53,0.25)"
            }`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}
        >
          {phase === "done" ? "✅" : "⚠️"}
        </div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 10,
            color: "#E8E8F0",
            letterSpacing: "-0.01em",
          }}
        >
          {heading}
        </h2>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.55)",
            marginBottom: 22,
            maxWidth: 420,
            margin: "0 auto 22px",
          }}
        >
          {sub}
        </p>

        {phase !== "done" && (
          <Link
            href="/matches"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: "#FF6B35",
              color: "white",
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 8,
              textDecoration: "none",
              marginBottom: 6,
              boxShadow: "0 4px 14px rgba(255,107,53,0.18)",
            }}
          >
            ← Voltar pra Minhas Demos
          </Link>
        )}

        <div
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.25)",
            marginTop: 14,
            fontFamily: "monospace",
          }}
        >
          ref: {staleMatchId.slice(0, 24)}…
        </div>
      </div>
    </div>
  );
}

/**
 * AnalyzingDemoView — full-page version do AnalyzingDemoModal.
 *
 * Sprint v5.7.2 (Mathieu spec): página de "re-analisando" deve ter
 * SOMENTE a UI de "analisando demo" com ad. Não card técnico com phase
 * indicators e progress bar feios.
 *
 * Layout match AnalyzingDemoModal (componentes/AnalyzingDemoModal.tsx)
 * mas inline (não fixed overlay) — fica dentro do AppShell content area.
 */
function AnalyzingDemoView({
  phase,
  elapsedSec,
}: {
  phase: "looking_up" | "uploading" | "analyzing" | string;
  elapsedSec: number;
}) {
  const STEPS = [
    { label: "Lendo arquivo .dem", icon: "📂" },
    { label: "Mapeando rounds e ticks", icon: "🎯" },
    { label: "Detectando kills do jogador", icon: "💀" },
    { label: "Calculando scoring (HS, distância, contexto)", icon: "📊" },
    { label: "Identificando jogadas de impacto", icon: "✨" },
    { label: "Quase lá...", icon: "⏳" },
  ];
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase context — substring abaixo do step principal pra não esconder
  // que estamos em looking_up ou uploading (info útil sem jargão).
  const phaseHint =
    phase === "looking_up"
      ? "Localizando demo no PC..."
      : phase === "uploading"
        ? "Enviando pra análise..."
        : null;

  return (
    <div className="flex items-center justify-center px-4 py-8 min-h-[60vh]">
      <div className="w-full max-w-3xl bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header — placeholder avatar (sem playerName conhecido aqui) */}
        <div className="relative px-6 pt-8 pb-5 bg-gradient-to-br from-[#FF6B35]/[0.10] via-transparent to-[#5D9CEC]/[0.05] border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 border-[#FF6B35]/40 shadow-[0_0_20px_rgba(255,107,53,0.2)] bg-[#FF6B35]/15 flex items-center justify-center text-base font-bold text-[#FF6B35]">
              ⏳
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6B35]/85 mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] animate-pulse" />
                Analisando demo
              </div>
              <h2 className="text-xl font-bold text-white leading-tight">
                Processando partida...
              </h2>
              <div className="text-xs text-white/50 mt-1.5 font-mono">
                {elapsedSec}s
              </div>
            </div>
          </div>
        </div>

        {/* Body — current step + progress */}
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-block w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <span className="text-base">{STEPS[stepIdx].icon}</span>
                {STEPS[stepIdx].label}
              </div>
              {phaseHint && (
                <div className="text-[11px] text-white/40 mt-0.5">
                  {phaseHint}
                </div>
              )}
            </div>
          </div>

          <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B35] via-[#FF8E53] to-[#FF6B35] rounded-full"
              style={{
                width: "40%",
                animation: "indeterminate-line 1.6s ease-in-out infinite",
              }}
            />
          </div>

          <p className="text-[11px] text-white/45 mt-3 leading-relaxed">
            A IA tá identificando as kills de maior impacto pra montar seu
            reel. Pode levar até 2 minutos dependendo do tamanho da demo.
          </p>
        </div>

        {/* Ad slot — Mathieu spec: "deve ter ad lá pois demora" */}
        <div className="px-6 py-5 bg-white/[0.01]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2 text-center">
            Patrocinado · enquanto a IA trabalha
          </div>
          <div className="flex items-center justify-center">
            <AdSlot
              id="reanalyze-ad"
              size="leaderboard"
              label="HyperX Cloud III · headset oficial CS2"
            />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes indeterminate-line {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(150%);
          }
          100% {
            transform: translateX(350%);
          }
        }
      `}</style>
    </div>
  );
}
