"use client";

/**
 * MatchesPageClient — Sprint DEMO-3 v3 (2026-05-08).
 *
 * Pivot de bot 24/7 → Steam Web API GetNextMatchSharingCode (Opção B).
 *
 * Estados:
 *   - skeleton: hydrating
 *   - needs_setup: user logado mas sem auth code → CTA pra /setup-steam
 *   - client_offline: setup OK mas client Windows não rodando → install CTA
 *   - loading: chamando walker
 *   - matches_found: lista renderizada
 *   - empty: walker retornou 0 matches novos (anchor é o mais recente)
 *   - error: walker falhou
 *
 * Layout AppShell + paleta gaming hybrid (laranja/preto/azul).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trophy, Lock, Download, KeyRound, AlertCircle } from "lucide-react";
import AppShell from "./AppShell";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { getUser, type SessionUser } from "@/lib/session";
import { useClientVersionStatus } from "@/lib/useClientVersionStatus";
import {
  getSteamAuthSetup,
  getLastKnownSharecode,
  setLastKnownSharecode,
} from "@/lib/steam-auth";
import DownloadButton from "./DownloadButton";

interface WalkerResponse {
  newSharecodes: string[];
  lastKnown: string;
  exhausted: boolean;
  error?: string;
}

type Status =
  | "skeleton"
  | "needs_setup"
  | "client_offline"
  | "loading"
  | "matches_found"
  | "empty"
  | "error";

export default function MatchesPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<Status>("skeleton");
  const [sharecodes, setSharecodes] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const clientStatus = useClientVersionStatus();

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
    const onFocus = () => setUser(getUser());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Não logado → /login
  useEffect(() => {
    if (hydrated && !user) router.push("/login");
  }, [hydrated, user, router]);

  const walk = useCallback(
    async (currentUser: SessionUser) => {
      const setup = getSteamAuthSetup();
      if (!setup) {
        setStatus("needs_setup");
        return;
      }

      const known = getLastKnownSharecode() || setup.anchorSharecode;
      setStatus("loading");
      setErrorMsg(null);

      try {
        const res = await fetch("/api/steam/walker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steamid: currentUser.steamid,
            authCode: setup.authCode,
            knownCode: known,
          }),
        });

        const data = (await res.json()) as WalkerResponse;

        if (!res.ok && !data.newSharecodes) {
          setStatus("error");
          setErrorMsg(data.error || `walker_http_${res.status}`);
          return;
        }

        if (data.lastKnown) setLastKnownSharecode(data.lastKnown);

        // Acumula com sharecodes já vistos (anchor + walked anteriores)
        setSharecodes((prev) => {
          const merged = [...prev];
          for (const s of data.newSharecodes) if (!merged.includes(s)) merged.push(s);
          return merged;
        });

        if (data.newSharecodes.length === 0 && sharecodes.length === 0) {
          setStatus("empty");
        } else {
          setStatus("matches_found");
        }
      } catch (e) {
        setStatus("error");
        setErrorMsg((e as Error).message || "fetch_failed");
      }
    },
    [sharecodes.length],
  );

  // Auto-walk on mount (uma vez quando user disponível)
  useEffect(() => {
    if (!hydrated || !user) return;
    if (clientStatus.status === "checking") return;
    if (clientStatus.status === "offline") {
      setStatus("client_offline");
      return;
    }
    void walk(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user, clientStatus.status]);

  if (!hydrated || !user || status === "skeleton") {
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
        status === "matches_found" || status === "empty" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => walk(user)}
          >
            <RefreshCw size={14} />
            Atualizar
          </Button>
        ) : null
      }
    >
      {status === "needs_setup" && <NeedsSetupState />}
      {status === "client_offline" && (
        <ClientOfflineState
          user={user}
          checking={clientStatus.status === "checking"}
        />
      )}
      {status === "loading" && <SkeletonState />}
      {status === "empty" && <EmptyState />}
      {status === "error" && <ErrorState message={errorMsg} onRetry={() => walk(user)} />}
      {status === "matches_found" && (
        <MatchesList sharecodes={sharecodes} />
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

function NeedsSetupState() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <Card className="p-6 lg:p-8 bg-gradient-to-br from-[#FF6B35]/10 via-transparent to-[#5D9CEC]/5 border-[#FF6B35]/20">
        <div className="flex items-start gap-4">
          <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/20 shrink-0">
            <KeyRound size={20} className="text-[#FF6B35]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FF6B35]/85">
                Conexão Steam pendente
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Conecte seu histórico de partidas
            </h2>
            <p className="text-sm text-white/60 mb-5 leading-relaxed max-w-2xl">
              Setup único de 30 segundos. Você cola 2 strings da Steam e o
              FragReel passa a descobrir suas partidas automaticamente. Mesmo
              padrão do Allstar e Leetify.
            </p>
            <Button onClick={() => router.push("/setup-steam")} size="lg">
              Conectar Steam
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview cards (mock blurred) — same look-and-feel do client_offline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-1">
              Preview · pós conexão
            </div>
            <div className="text-xs text-white/45">
              Suas matches reais aparecem aqui
            </div>
          </div>
          <Lock size={14} className="text-white/30" />
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

function ClientOfflineState({
  user: _user,
  checking,
}: {
  user: SessionUser;
  checking: boolean;
}) {
  return (
    <div className="space-y-6">
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="h-12 w-12 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
        <Trophy size={20} className="text-white/40" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Nenhuma partida nova ainda</h2>
      <p className="text-sm text-white/45 max-w-md">
        Sua âncora é a partida mais recente. Jogue mais um match que ele
        aparece aqui automaticamente — clica em &ldquo;Atualizar&rdquo; pra checar.
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  const friendly = friendlyError(message);
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="h-12 w-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertCircle size={20} className="text-red-400" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Erro ao buscar partidas</h2>
      <p className="text-sm text-white/55 max-w-md mb-5">{friendly}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw size={14} />
          Tentar de novo
        </Button>
        {message?.includes("valve_api_4") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = "/setup-steam?force=1")}
          >
            Reconectar Steam
          </Button>
        )}
      </div>
    </div>
  );
}

function friendlyError(msg: string | null): string {
  if (!msg) return "Erro desconhecido. Tenta de novo em alguns segundos.";
  if (msg.includes("valve_api_403")) {
    return "Auth code rejeitado pela Steam. Pode ter sido revogado — reconecta o Steam pra gerar novo.";
  }
  if (msg.includes("valve_api_429")) {
    return "Steam pediu pra esperar (rate limit). Tenta de novo em 30s.";
  }
  if (msg.includes("server_misconfig")) {
    return "Configuração do servidor pendente. Avisa o admin do FragReel.";
  }
  return msg;
}

function MatchesList({ sharecodes }: { sharecodes: string[] }) {
  return (
    <div className="space-y-3 mt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-1">
        {sharecodes.length} {sharecodes.length === 1 ? "partida" : "partidas"} disponíveis
      </div>

      {/* TODO próximo PR: enriquecer com map/score/players via análise da
          demo (cliente FragReel POSTa metadados quando baixa). Por ora
          mostra cards minimalistas com sharecode + "Ver detalhes". */}
      {sharecodes.map((code) => (
        <SharecodeCard key={code} sharecode={code} />
      ))}
    </div>
  );
}

function SharecodeCard({ sharecode }: { sharecode: string }) {
  const router = useRouter();
  const shortCode = sharecode.replace(/^CSGO-/, "").slice(0, 11) + "…";

  return (
    <Card
      className="p-3.5 cursor-pointer hover:border-[#FF6B35]/30 transition-colors"
      onClick={() => router.push(`/match/${encodeURIComponent(sharecode)}`)}
    >
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 w-[110px] h-[64px] rounded-md border flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #FF6B3540 0%, #0d0d18 70%)",
            borderColor: "#FF6B3540",
          }}
        >
          <Trophy size={20} className="text-[#FF6B35]/70" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <span className="text-sm font-mono text-white/90">{shortCode}</span>
            <Badge variant="subtle">Aguardando análise</Badge>
          </div>
          <div className="text-xs text-white/45">
            Cliente FragReel vai baixar e analisar quando rodar próximo
          </div>
        </div>

        <span className="text-base font-bold text-[#FF6B35]/45 shrink-0">→</span>
      </div>
    </Card>
  );
}

// ── Preview match card (mock blurred state) ─────────────────────────────────

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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <span className="text-base font-bold font-mono tracking-tight text-white">
              {score}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              {mode}
            </span>
            <Badge variant="success">{outcome}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/45 font-mono">
            <span>KD {kd}</span>
            <span>{hsCount} HS</span>
            <span>{date}</span>
          </div>
        </div>

        <span className="text-base font-bold text-[#FF6B35]/45 shrink-0">→</span>
      </div>
    </Card>
  );
}
