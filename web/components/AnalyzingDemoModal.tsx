"use client";

/**
 * AnalyzingDemoModal — overlay fullscreen "Analisando demo do ponto de
 * vista de [player]".
 *
 * Sprint v5.5 (08/05/2026 Mathieu spec):
 *   "Mate a página do re-mapeando kills de impacto. Tem que ser:
 *    Analisando demo do ponto de vista do [player name], tem que ter
 *    espaço pra ad aqui pois demora até 30 segundos."
 *
 * Substitui o Loader2 inline em MinhasDemosClient + a tela
 * "Re-analisando..." que existia em /match/[id]/AutoReanalyze ou
 * estados de scoring intermediários.
 *
 * Shows enquanto scoreDemoForPlayer() roda. Fecha via redirect
 * automático pelo parent quando análise concluir.
 */

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trophy, X } from "lucide-react";
import AdSlot from "./AdSlot";

interface Props {
  /** Display name do player (do roster — pode ser nick) */
  playerName: string;
  /** Steam avatar URL pré-fetched (opcional). */
  playerAvatar?: string;
  /** Map name pretty (ex: "Inferno"). */
  mapName: string;
  /** Optional cancel callback (mostra X). Se omitted, modal não cancelável. */
  onCancel?: () => void;
}

export default function AnalyzingDemoModal({
  playerName,
  playerAvatar,
  mapName,
  onCancel,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  // Step rotation pra entreter user durante 5-30s de espera.
  // Cada step fica visible ~4s, daí cicla. Fake progress mas honesto
  // (esses steps DE FATO acontecem em ordem no scoring backend).
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
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = playerName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const mapPretty =
    mapName.replace(/^de_/, "").charAt(0).toUpperCase() +
    mapName.replace(/^de_/, "").slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Optional cancel */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
            title="Cancelar análise"
          >
            <X size={16} />
          </button>
        )}

        {/* Header — playerName destaque */}
        <div className="relative px-6 pt-8 pb-5 bg-gradient-to-br from-[#FF6B35]/[0.10] via-transparent to-[#5D9CEC]/[0.05] border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            {/* Avatar do player (Steam avatar ou initials) */}
            <div
              className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 border-[#FF6B35]/40 shadow-[0_0_20px_rgba(255,107,53,0.2)]"
            >
              {playerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playerAvatar}
                  alt={playerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-base font-bold bg-[#FF6B35]/15 text-[#FF6B35]">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6B35]/85 mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] animate-pulse" />
                Analisando demo
              </div>
              <h2 className="text-xl font-bold text-white leading-tight">
                Ponto de vista de{" "}
                <span className="text-[#FF6B35]">{playerName}</span>
              </h2>
              <div className="text-xs text-white/50 mt-1.5 flex items-center gap-2 font-mono">
                <Trophy size={11} className="text-white/40" />
                {mapPretty}
                <span className="text-white/20">·</span>
                <span>{elapsed}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body — current step + progress visual */}
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <Loader2
              size={16}
              className="text-[#FF6B35] animate-spin shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white/90 truncate flex items-center gap-2">
                <span className="text-base">{STEPS[stepIdx].icon}</span>
                {STEPS[stepIdx].label}
              </div>
            </div>
          </div>

          {/* Indeterminate progress bar */}
          <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B35] via-[#FF8E53] to-[#FF6B35] rounded-full"
              style={{
                width: "40%",
                animation: "indeterminate 1.6s ease-in-out infinite",
              }}
            />
          </div>

          <p className="text-[11px] text-white/45 mt-3 leading-relaxed">
            A IA tá identificando as kills de maior impacto pra montar seu
            reel. Pode levar até 30s na primeira vez — ficamos com cache
            depois pra ser instantâneo.
          </p>
        </div>

        {/* Ad slot — Sprint v5.5 spec literal: "tem que ter espaço pra ad
            aqui pois demora até 30 segundos". Banner médio centralizado. */}
        <div className="px-6 py-5 bg-white/[0.01]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2 text-center">
            Patrocinado · enquanto a IA trabalha
          </div>
          <div className="flex items-center justify-center">
            <AdSlot
              id="analyzing-modal-ad"
              size="leaderboard"
              label="HyperX Cloud III · headset oficial CS2"
            />
          </div>
        </div>
      </div>

      {/* Indeterminate animation */}
      <style jsx global>{`
        @keyframes indeterminate {
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
