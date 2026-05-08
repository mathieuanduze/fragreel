"use client";

/**
 * MatchesPageClient — Sprint DEMO-3 v2 (08/05/2026).
 *
 * Layout AppShell (sidebar) + Shadcn UI components.
 * Mathieu spec: paleta gaming híbrida (laranja + azul + dark deep) com
 * polidez Linear/Vercel.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trophy, Lock, Download } from "lucide-react";
import AppShell from "./AppShell";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { getUser, type SessionUser } from "@/lib/session";
import { useClientVersionStatus } from "@/lib/useClientVersionStatus";
import DownloadButton from "./DownloadButton";

export default function MatchesPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const clientStatus = useClientVersionStatus();

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
    const onFocus = () => setUser(getUser());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Não logado → redireciona pra /login
  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <AppShell>
        <SkeletonState />
      </AppShell>
    );
  }

  const subtitle = `Olá, ${user.name}`;

  return (
    <AppShell
      title="Match History"
      subtitle={subtitle}
      topbarActions={
        <Button variant="outline" size="sm">
          <RefreshCw size={14} />
          Atualizar
        </Button>
      }
    >
      {/* TODO Sprint DEMO-3 v2: bot servidor Fly.io retorna match history.
          MVP atual mostra estado client_offline com preview cards. Quando
          server-side bot implementar, swap pra real data. */}
      {clientStatus.status === "offline" || clientStatus.status === "checking" ? (
        <ClientOfflineState user={user} checking={clientStatus.status === "checking"} />
      ) : (
        <ReadyEmptyState />
      )}
    </AppShell>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

function SkeletonState() {
  return (
    <div className="space-y-3 mt-6">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-[88px] rounded-lg bg-white/[0.025] border border-white/[0.06] animate-pulse"
        />
      ))}
    </div>
  );
}

function ClientOfflineState({
  user,
  checking,
}: {
  user: SessionUser;
  checking: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Hero card — install CTA */}
      <Card className="p-6 lg:p-8 bg-gradient-to-br from-[rgb(var(--color-primary))]/[0.04] to-transparent border-[rgb(var(--color-primary))]/10">
        <div className="flex items-start gap-4">
          <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-lg bg-[rgb(var(--color-primary))]/10 border border-[rgb(var(--color-primary))]/20 shrink-0">
            <Download size={20} className="text-[rgb(var(--color-primary))]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-primary))] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-primary))]/85">
                {checking ? "Detectando client..." : "Client offline"}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[rgb(var(--color-foreground))] mb-2">
              Próximo passo: instalar o FragReel
            </h2>
            <p className="text-sm text-[rgb(var(--color-foreground))]/55 mb-5 leading-relaxed max-w-2xl">
              Suas matches CS2 vão aparecer aqui automaticamente assim que o
              client estiver rodando. Render no seu PC = qualidade Major,
              grátis pra sempre.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <DownloadButton
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary))]/90 transition-colors shadow-[0_4px_14px_rgba(255,107,53,0.25)]"
              >
                <Download size={14} />
                Baixar grátis pro Windows
              </DownloadButton>
              <span className="text-xs text-[rgb(var(--color-foreground))]/40 font-mono">
                ~120 MB · Win 10/11
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Preview matches (mock blurred) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--color-foreground))]/35 mb-1">
              Preview · pós install
            </div>
            <div className="text-xs text-[rgb(var(--color-foreground))]/45">
              Suas matches reais aparecem aqui
            </div>
          </div>
          <Lock size={14} className="text-[rgb(var(--color-foreground))]/30" />
        </div>

        <div className="space-y-2 opacity-60 blur-[0.5px] pointer-events-none select-none">
          <PreviewMatchCard map="overpass" mapColor="#B0886A" score="13:11" mode="Competitive" kd="15/16" hsCount={5} outcome="WIN" date="20h atrás" />
          <PreviewMatchCard map="mirage" mapColor="#E8C896" score="16:13" mode="Premier" kd="22/14" hsCount={9} outcome="WIN" date="2d atrás" />
          <PreviewMatchCard map="inferno" mapColor="#FF6B35" score="13:9" mode="Competitive" kd="20/17" hsCount={6} outcome="WIN" date="5d atrás" />
        </div>
      </div>
    </div>
  );
}

function ReadyEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="h-12 w-12 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
        <Trophy size={20} className="text-[rgb(var(--color-foreground))]/40" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Carregando suas matches</h2>
      <p className="text-sm text-[rgb(var(--color-foreground))]/45 max-w-md">
        Estamos buscando suas partidas CS2 recentes. Pode levar alguns segundos.
      </p>
      <Badge variant="warning" className="mt-4">
        DEMO-3 v2 — bot servidor em desenvolvimento
      </Badge>
    </div>
  );
}

// ── Preview match card ──────────────────────────────────────────────────────

function PreviewMatchCard({
  map,
  mapColor,
  score,
  mode,
  kd,
  hsCount,
  outcome,
  date,
}: {
  map: string;
  mapColor: string;
  score: string;
  mode: string;
  kd: string;
  hsCount: number;
  outcome: "WIN" | "LOSS" | "TIE";
  date: string;
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-4">
        {/* Map thumb */}
        <div
          className="shrink-0 w-[110px] h-[64px] rounded-md border flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${mapColor}40 0%, #0d0d18 70%)`,
            borderColor: `${mapColor}40`,
          }}
        >
          <span
            className="text-[11px] font-extrabold tracking-[0.10em] uppercase"
            style={{
              color: mapColor,
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {map}
          </span>
        </div>

        {/* Info center */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <span className="text-base font-bold font-mono tracking-tight text-[rgb(var(--color-foreground))]">
              {score}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--color-foreground))]/45">
              {mode}
            </span>
            <Badge variant="success">{outcome}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-[rgb(var(--color-foreground))]/45 font-mono">
            <span>KD {kd}</span>
            <span>{hsCount} HS</span>
            <span>{date}</span>
          </div>
        </div>

        {/* Arrow */}
        <span className="text-base font-bold text-[rgb(var(--color-primary))]/45 shrink-0">→</span>
      </div>
    </Card>
  );
}
