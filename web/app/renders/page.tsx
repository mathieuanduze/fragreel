"use client";

/**
 * /renders — "Meus FragReels" (Sprint v5.2, 08/05/2026 Mathieu spec).
 *
 * "Você não criou a seção meus fragreels onde guardamos o histórico
 * do gerado e podemos guardar as specs do que foi gerado (plays
 * selecionadas, música selecionada, toggles, etc). Aí o CTA é
 * gerar fragreel novamente, onde ele vai pra página /match"
 *
 * MVP: 1 reel salvo por vez (último, TTL 1h). Próxima iteração:
 * lista de N reels server-side com user scoping.
 *
 * Click "Gerar novamente" → /match/[id] (specs persistidas via
 * localStorage permitem MatchClient pré-popular highlights/mood/etc).
 *
 * Click "Abrir vídeo" → POST 127.0.0.1:5775/render/open pra abrir
 * MP4 no player default do OS.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  FolderOpen,
  RefreshCw,
  Trophy,
  Clock,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getRecentRender,
  getRecentRenderTTLMinutes,
  clearRecentRender,
  specsSummary,
  type FragReelSpec,
} from "@/lib/recentRender";

const LOCAL_BASE = "http://127.0.0.1:5775";

export default function MeusFragReelsPage() {
  const router = useRouter();
  const [render, setRender] = useState<FragReelSpec | null>(null);
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
      <AppShell title="Meus FragReels">
        <div className="h-32 rounded-xl bg-white/[0.025] border border-white/[0.06] animate-pulse" />
      </AppShell>
    );
  }

  if (!render) {
    return (
      <AppShell
        title="Meus FragReels"
        subtitle="Histórico dos seus reels · 1h"
      >
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 max-w-2xl mx-auto">
          <div className="h-14 w-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
            <Film size={26} className="text-white/40" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">Nenhum reel gerado ainda</h2>
          <p className="text-sm text-white/55 max-w-md mx-auto mb-5">
            Reels ficam aqui por 1h após gerados, com as specs salvas (plays,
            música, mood) — assim você pode recriar com 1 click.
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
  const summary = specsSummary(render);

  return (
    <AppShell
      title="Meus FragReels"
      subtitle="Histórico dos seus reels · 1h"
    >
      <div className="max-w-3xl space-y-4">
        <Card className="p-5 bg-gradient-to-br from-[#FF6B35]/[0.04] via-transparent to-transparent border-[#FF6B35]/20">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-14 w-14 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/25 flex items-center justify-center shrink-0">
              <Film size={26} className="text-[#FF6B35]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 className="text-base font-bold text-white capitalize">
                  {render.mapName}
                </h3>
                {render.playerName && (
                  <Badge variant="default">{render.playerName}</Badge>
                )}
                <Badge variant="success">Pronto</Badge>
              </div>
              <div className="text-xs text-white/60 mb-1">{summary}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                <Clock size={11} />
                <span>Expira em ~{minutesLeft}min</span>
              </div>
            </div>
          </div>

          {/* Specs detail */}
          {render.selectedHighlightIds && render.selectedHighlightIds.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 pt-3 border-t border-white/[0.06]">
              <SpecItem
                label="Cenas"
                value={String(render.selectedHighlightIds.length)}
              />
              {render.mood && <SpecItem label="Mood" value={render.mood} />}
              {render.orientation && (
                <SpecItem
                  label="Formato"
                  value={
                    render.orientation === "vertical"
                      ? "Vertical 9:16"
                      : "Horizontal 16:9"
                  }
                />
              )}
              {render.musicTrack && (
                <SpecItem label="Trilha" value={render.musicTrack} />
              )}
            </div>
          )}

          {/* MP4 path */}
          <div className="text-xs text-white/45 mb-4 font-mono break-all p-2 rounded bg-black/30 border border-white/5">
            {render.mp4Path}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleOpen} disabled={opening}>
              <FolderOpen size={14} />
              {opening ? "Abrindo..." : "Abrir vídeo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/match/${render.matchId}`)}
            >
              <Sparkles size={14} />
              Gerar novamente
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
        </Card>

        {/* Info card */}
        <Card className="p-4 bg-white/[0.01]">
          <div className="text-[11px] text-white/45 leading-relaxed">
            <strong className="text-white/70">Como funciona:</strong> quando
            você gera um reel, salvamos as specs (cenas, mood, formato, etc)
            por 1h — assim você pode usar o mesmo player como ponto de
            partida e ajustar. Histórico cross-device + persistente vem
            quando habilitarmos accounts pagos.
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.025] border border-white/[0.05] p-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-0.5">
        {label}
      </div>
      <div className="text-xs font-semibold text-white capitalize truncate">
        {value}
      </div>
    </div>
  );
}
