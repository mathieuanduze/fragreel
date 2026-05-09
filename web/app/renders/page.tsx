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
  Share2,
  Copy,
  CheckCircle2,
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
  const [copied, setCopied] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

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

  // Sprint v5.7.18 (Mathieu 09/05/2026 round 3): "Nos meus fragreels
  // poderia ter os botões de compartilhamento também". Replica o pattern
  // do RenderReadyScreen — copy-path strategy + wa.me intent. Browsers
  // não conseguem anexar local file via API, então é copy + instrução.
  function handleCopyPath() {
    if (!render?.mp4Path) return;
    navigator.clipboard.writeText(render.mp4Path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareTextFor(r: FragReelSpec) {
    const m = r.mapName ? ` no ${r.mapName.replace(/^de_/, "")}` : "";
    const p = r.playerName ? ` (${r.playerName})` : "";
    return `Meu FragReel${m} 🎯${p} — feito em fragreel.gg`;
  }

  function handleWhatsApp() {
    if (!render) return;
    const url = `https://wa.me/?text=${encodeURIComponent(shareTextFor(render))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShareHint(
      "WhatsApp abriu — agora anexa o vídeo (clipe icon) e seleciona o arquivo da pasta",
    );
  }

  function handleInstagram() {
    handleCopyPath();
    setShareHint(
      "Caminho copiado! Abre Instagram → Reels/Story → '+' → seleciona o vídeo",
    );
  }

  function handleTikTok() {
    handleCopyPath();
    setShareHint(
      "Caminho copiado! Abre TikTok → '+' → 'Upload' → seleciona o vídeo",
    );
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

          {/* Actions — "Abrir vídeo" só renderiza se mp4Path foi
              capturado (Sprint v5.7.4 — render pode concluir sem path
              imediato em alguns paths assíncronos). */}
          <div className="flex items-center gap-2 flex-wrap">
            {render.mp4Path && (
              <Button onClick={handleOpen} disabled={opening}>
                <FolderOpen size={14} />
                {opening ? "Abrindo..." : "Abrir vídeo"}
              </Button>
            )}
            <Button
              variant={render.mp4Path ? "outline" : "default"}
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

          {/* Sprint v5.7.18 — Share row (mesmo pattern do RenderReadyScreen) */}
          {render.mp4Path && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2.5">
                <Share2 size={10} />
                Compartilhar nas redes
              </div>
              <div className="grid grid-cols-4 gap-2">
                <ShareChip
                  label="WhatsApp"
                  color="#25D366"
                  onClick={handleWhatsApp}
                  svgPath="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.595 5.45l.36.572-1.014 3.7 3.748-.99zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"
                />
                <ShareChip
                  label="Instagram"
                  color="#E4405F"
                  onClick={handleInstagram}
                  svgPath="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
                />
                <ShareChip
                  label="TikTok"
                  color="#fff"
                  onClick={handleTikTok}
                  svgPath="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.84-.1z"
                />
                <button
                  onClick={handleCopyPath}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-white/65"
                  title="Copiar caminho do arquivo"
                >
                  {copied ? (
                    <CheckCircle2 size={18} className="text-[#5be38f]" />
                  ) : (
                    <Copy size={18} />
                  )}
                  <span className="text-[10px] font-bold tracking-wide">
                    {copied ? "Copiado" : "Copiar path"}
                  </span>
                </button>
              </div>
              {shareHint && (
                <div className="mt-3 text-[11px] text-white/70 leading-relaxed p-2.5 rounded bg-[#FF6B35]/[0.08] border border-[#FF6B35]/20">
                  💡 {shareHint}
                </div>
              )}
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

function ShareChip({
  label,
  color,
  svgPath,
  onClick,
}: {
  label: string;
  color: string;
  svgPath: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border bg-white/[0.03] hover:-translate-y-px transition-all"
      style={{
        borderColor: color === "#fff" ? "rgba(255,255,255,0.2)" : `${color}50`,
        color,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d={svgPath} />
      </svg>
      <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </button>
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
