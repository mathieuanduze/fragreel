"use client";

/**
 * /library — "Demos Analisadas" (Sprint DEMO-3 v3, 08/05/2026).
 *
 * Renomeada de "Demos locais" pra "Demos Analisadas" — Mathieu spec:
 * "uma sessão com as demos que já foram analisadas — ele vê os jogos
 * que já passaram pela IA, ranking das kills com fotos dos players,
 * clica na foto e aparecem as kills de impacto, escolhe player + cenas
 * + features".
 *
 * Esta page lista as demos. O fluxo rico (player roster com fotos,
 * filtragem de kills por player) já vive em /demo/[sha]/DemoRosterClient
 * → /match/[id]/MatchClient (com KILL POV badge tooltip + cenas + mood
 * + HUD bomb timer + cinematic toggles). Não duplicar aqui.
 *
 * Migra de Nav top-bar pra AppShell sidebar (mata as abas redundantes).
 */

import AppShell from "@/components/AppShell";
import LibraryContent from "@/components/LibraryContent";

export default function Library() {
  return (
    <AppShell
      title="Demos Analisadas"
      subtitle="Suas partidas + demos importadas, prontas pra virar reel"
    >
      {/* Sprint #7 (05/05) — clarifica 2 fontes (auto / manual). Mantida
          em 2 cards compactos. AdSlot removido pra ficar mais sóbrio
          (Mathieu DEMO-3 v3 spec — paleta reduzida). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-5">
        <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3.5 py-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold">
            ✓
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90 mb-0.5">
              Automático
            </div>
            <div className="text-[11px] text-white/55 leading-snug">
              Partidas CS2 em{" "}
              <code className="text-[#FF6B35] text-[10px] font-mono">
                csgo/replays/
              </code>{" "}
              — detectadas pelo client
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3.5 py-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold">
            ⬇
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-violet-400/90 mb-0.5">
              Manual
            </div>
            <div className="text-[11px] text-white/55 leading-snug">
              Demos pro players:{" "}
              <a
                href="https://www.hltv.org/results"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF6B35] hover:underline"
              >
                HLTV
              </a>{" "}
              ou{" "}
              <a
                href="https://csgostats.gg/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF6B35] hover:underline"
              >
                CSGOStats
              </a>{" "}
              → drop em{" "}
              <code className="text-[#FF6B35] text-[10px] font-mono">
                replays/
              </code>
            </div>
          </div>
        </div>
      </div>

      <LibraryContent />
    </AppShell>
  );
}
