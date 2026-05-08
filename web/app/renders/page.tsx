"use client";

/**
 * /renders — Renders Recentes (Sprint DEMO-3 v5, 08/05/2026 Mathieu spec).
 *
 * "vamos armazenar por 1h o último reel gerado". localStorage TTL.
 * Se nada gravado nas últimas 1h, mostra empty state.
 * Click "Abrir" → POST 127.0.0.1:5775/render/open (já existente no client).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, FolderOpen, RefreshCw, Trophy, Clock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getRecentRender,
  getRecentRenderTTLMinutes,
  clearRecentRender,
  type RecentRender,
} from "@/lib/recentRender";

const LOCAL_BASE = "http://127.0.0.1:5775";

export default function RendersPage() {
  const router = useRouter();
  const [render, setRender] = useState<RecentRender | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRender(getRecentRender());
    setHydrated(true);
    // Refresh a cada 60s pra atualizar TTL display
    const id = setInterval(() => setRender(getRecentRender()), 60_000);
    return () => clearInterval(id);
  }, []);

  async function handleOpen() {
    if (!render) return;
    setOpening(true);
    setError(null);
    try {
      const res = await fetch(`${LOCAL_BASE}/render/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: render.mp4Path }),
      });
      if (!res.ok) throw new Error(`open_failed_${res.status}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }

  function handleClear() {
    clearRecentRender();
    setRender(null);
  }

  if (!hydrated) {
    return (
      <AppShell title="Renders Recentes">
        <div className="h-32 rounded-xl bg-white/[0.025] border border-white/[0.06] animate-pulse" />
      </AppShell>
    );
  }

  if (!render) {
    return (
      <AppShell title="Renders Recentes" subtitle="Histórico do último reel · 1h">
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 max-w-2xl mx-auto">
          <div className="h-14 w-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
            <Film size={26} className="text-white/40" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">Nenhum reel recente</h2>
          <p className="text-sm text-white/55 max-w-md mx-auto mb-5">
            Renders ficam aqui por 1h após gerados. Vai em{" "}
            <span className="text-[#FF6B35]">Minhas Demos</span> e gera seu
            primeiro FragReel.
          </p>
          <Button onClick={() => router.push("/matches")}>
            <Trophy size={14} />
            Ir pra Minhas Demos
          </Button>
        </div>
      </AppShell>
    );
  }

  const minutesLeft = getRecentRenderTTLMinutes(render);

  return (
    <AppShell
      title="Renders Recentes"
      subtitle="Histórico do último reel · 1h"
    >
      <div className="max-w-2xl">
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center shrink-0">
              <Film size={26} className="text-[#FF6B35]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 className="text-base font-bold text-white capitalize">
                  {render.mapName}
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Pronto
                </span>
              </div>
              <div className="text-xs text-white/55 mb-3 font-mono break-all">
                {render.mp4Path}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/45 mb-4">
                <Clock size={11} />
                <span>Expira em ~{minutesLeft}min</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={handleOpen} disabled={opening}>
                  <FolderOpen size={14} />
                  {opening ? "Abrindo..." : "Abrir vídeo"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/match/${render.matchId}`)
                  }
                >
                  Re-render / editar
                </Button>
                <button
                  onClick={handleClear}
                  className="text-[11px] text-white/35 hover:text-white/60 ml-auto"
                >
                  Remover do histórico
                </button>
              </div>

              {error && (
                <div className="mt-3 text-xs text-red-400 font-mono">
                  {error}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
