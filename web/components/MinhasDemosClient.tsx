"use client";

/**
 * MinhasDemosClient — UNIFIED inline expand (Sprint DEMO-3 v5, 08/05/2026).
 *
 * Mathieu spec literal:
 *   "minhas demos e demos analisadas, sao muito redundantes... user nao
 *    vai entender a diferenca... Unificar Minhas Demos + Demos Analisadas
 *    em 1 tela com expand inline"
 *
 * Features:
 *   - Lista única de TODAS as demos do PC (analyzed + non-analyzed)
 *   - Cards: map thumb + score + KD + status badge (Analisada ✓ / Pendente)
 *   - Click card → expande inline mostrando roster
 *   - Click player no roster → /match/[id] direto (no double picker)
 *   - Topbar action: "Importar .dem" → modal explicando 2 fontes
 *   - Hover gamer backlight (orange glow)
 *
 * Estados handled:
 *   - skeleton (hydrating + first load)
 *   - client_initializing (503 setup_in_progress) — NEW
 *   - client_offline
 *   - empty (nenhuma demo)
 *   - list (tem demos)
 *   - error
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  Trophy,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import AppShell from "./AppShell";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import DownloadButton from "./DownloadButton";
import ImportDemoModal from "./ImportDemoModal";
import {
  getLocalDemos,
  getDemoRoster,
  pingLocalClient,
  LocalClientOffline,
  type LocalDemo,
  type DemoRosterPlayer,
  type DemoRosterResponse,
} from "@/lib/local";
import { useClientVersionStatus } from "@/lib/useClientVersionStatus";
import { getUser, type SessionUser } from "@/lib/session";

type Status =
  | "skeleton"
  | "initializing"
  | "offline"
  | "empty"
  | "list"
  | "error";

const TEAM_COLOR = { 2: "#fbbf24", 3: "#5D9CEC" } as const;

interface AvatarMap {
  [steamid: string]: string;
}

export default function MinhasDemosClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [demos, setDemos] = useState<LocalDemo[] | null>(null);
  const [status, setStatus] = useState<Status>("skeleton");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "analyzed" | "pending">(
    "all",
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const clientVersion = useClientVersionStatus();

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !user) router.push("/login");
  }, [hydrated, user, router]);

  const load = useCallback(async (refresh = false) => {
    setErrorMsg(null);
    try {
      const r = await getLocalDemos(refresh);
      setDemos(r.matches);
      setScanning(r.scanning);
      if (r.matches.length === 0 && !r.scanning) {
        setStatus("empty");
      } else {
        setStatus("list");
      }
    } catch (e) {
      if (e instanceof LocalClientOffline) {
        setStatus("offline");
        return;
      }
      const msg = (e as Error).message;
      // Sprint v5 fix: 503 setup_in_progress = client subindo, NÃO offline.
      // UX vira "Inicializando" + retry automático em 3s.
      if (/setup_in_progress|setup.in.progress|503/i.test(msg)) {
        setStatus("initializing");
        return;
      }
      setStatus("error");
      setErrorMsg(msg);
    }
  }, []);

  useEffect(() => {
    if (hydrated && user) void load(true);
  }, [hydrated, user, load]);

  // Polling enquanto scanning (igual /library tinha)
  useEffect(() => {
    if (!scanning || status !== "list") return;
    let alive = true;
    const id = setInterval(async () => {
      if (!alive) return;
      try {
        const r = await getLocalDemos(false);
        if (!alive) return;
        setDemos(r.matches);
        setScanning(r.scanning);
      } catch (e) {
        if (e instanceof LocalClientOffline && alive) {
          setStatus("offline");
          setScanning(false);
        }
      }
    }, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [scanning, status]);

  // Polling enquanto initializing — retry a cada 3s até client responder.
  useEffect(() => {
    if (status !== "initializing") return;
    let alive = true;
    const id = setInterval(() => {
      if (alive) void load(false);
    }, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [status, load]);

  // Auto-recover ONLINE quando client volta
  useEffect(() => {
    if (status !== "offline") return;
    let alive = true;
    const id = setInterval(async () => {
      const ok = await pingLocalClient();
      if (alive && ok) {
        clearInterval(id);
        void load(false);
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [status, load]);

  const filtered = useMemo(() => {
    if (!demos) return [];
    if (filterMode === "all") return demos;
    if (filterMode === "analyzed") return demos.filter((d) => !!d.match_id);
    return demos.filter((d) => !d.match_id);
  }, [demos, filterMode]);

  const counts = useMemo(() => {
    const all = demos?.length || 0;
    const analyzed = demos?.filter((d) => !!d.match_id).length || 0;
    const pending = all - analyzed;
    return { all, analyzed, pending };
  }, [demos]);

  if (!hydrated || !user || status === "skeleton") {
    return (
      <AppShell>
        <SkeletonState />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Minhas Demos"
      subtitle={`Olá, ${user.name} · demos detectadas no seu PC`}
      topbarActions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={scanning}
          >
            <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Escaneando..." : "Atualizar"}
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <UploadCloud size={14} />
            Importar .dem
          </Button>
        </>
      }
    >
      {status === "initializing" && <InitializingState />}
      {status === "offline" && <OfflineState onRetry={() => void load(false)} />}
      {status === "error" && (
        <ErrorState message={errorMsg} onRetry={() => void load(true)} />
      )}
      {status === "empty" && <EmptyState onImport={() => setImportOpen(true)} />}
      {status === "list" && demos && (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 mb-4">
            <FilterTab
              active={filterMode === "all"}
              count={counts.all}
              onClick={() => setFilterMode("all")}
            >
              Todas
            </FilterTab>
            <FilterTab
              active={filterMode === "analyzed"}
              count={counts.analyzed}
              onClick={() => setFilterMode("analyzed")}
            >
              Analisadas
            </FilterTab>
            <FilterTab
              active={filterMode === "pending"}
              count={counts.pending}
              onClick={() => setFilterMode("pending")}
            >
              Pendentes
            </FilterTab>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {filtered.map((d) => (
              <DemoCard
                key={d.sha1}
                demo={d}
                expanded={expanded === d.sha1}
                onToggle={() =>
                  setExpanded(expanded === d.sha1 ? null : d.sha1)
                }
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-white/50">
                Nenhuma demo na categoria{" "}
                <span className="text-white/80">{filterMode}</span>
              </div>
            )}
          </div>
        </>
      )}

      {importOpen && <ImportDemoModal onClose={() => setImportOpen(false)} />}
    </AppShell>
  );
}

// ── Filter tab ─────────────────────────────────────────────────────────────

function FilterTab({
  children,
  count,
  active,
  onClick,
}: {
  children: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
        active
          ? "bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30"
          : "bg-white/[0.02] text-white/55 border border-white/5 hover:bg-white/[0.05] hover:text-white/80"
      }`}
    >
      <span>{children}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          active ? "bg-[#FF6B35]/20" : "bg-white/[0.05]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ── Demo card ──────────────────────────────────────────────────────────────

function DemoCard({
  demo,
  expanded,
  onToggle,
}: {
  demo: LocalDemo;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const isAnalyzed = !!demo.match_id;
  const date = new Date(demo.mtime * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
  const totalRounds = demo.score_ct + demo.score_t;
  const kd =
    demo.player_deaths > 0
      ? (demo.player_kills / demo.player_deaths).toFixed(2)
      : demo.player_kills.toFixed(2);
  const mapPretty = prettyMap(demo.map_name);
  const mapImg = `/maps/${demo.map_name}.png`;

  return (
    <div
      className={`group rounded-xl border transition-all overflow-hidden ${
        expanded
          ? "border-[#FF6B35]/40 bg-[#FF6B35]/[0.03] shadow-[0_0_30px_rgba(255,107,53,0.12)]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-[#FF6B35]/25 hover:bg-white/[0.03] hover:shadow-[0_0_20px_rgba(255,107,53,0.08)]"
      }`}
    >
      {/* Header (clickable) */}
      <button
        onClick={onToggle}
        className="w-full flex items-stretch gap-0 cursor-pointer text-left"
      >
        {/* Map thumb */}
        <div
          className="relative shrink-0 w-[160px] h-[100px] overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapImg}
            alt={mapPretty}
            className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 transition-opacity"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a12]/40 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <div className="text-[15px] font-extrabold text-white leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {mapPretty}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isAnalyzed ? (
              <Badge variant="success">
                <CheckCircle2 size={11} />
                Analisada
              </Badge>
            ) : (
              <Badge variant="warning">
                <Clock size={11} />
                Pendente
              </Badge>
            )}
            <span className="text-[11px] text-white/40 font-mono">
              {date}
            </span>
            <span className="text-[11px] text-white/30">·</span>
            <span className="text-[11px] text-white/40">
              {totalRounds} rounds · {demo.size_mb} MB
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl font-bold font-mono tracking-tight ${
                  demo.score_ct > demo.score_t
                    ? "text-[#5D9CEC]"
                    : "text-white/85"
                }`}
              >
                {demo.score_ct}
              </span>
              <span className="text-white/30 text-base">:</span>
              <span
                className={`text-xl font-bold font-mono tracking-tight ${
                  demo.score_t > demo.score_ct
                    ? "text-[#fbbf24]"
                    : "text-white/85"
                }`}
              >
                {demo.score_t}
              </span>
            </div>
            <div className="flex items-baseline gap-3 text-xs text-white/55 font-mono">
              <span>
                <span className="text-white/35">K/D</span>{" "}
                <span className="text-white">
                  {demo.player_kills}/{demo.player_deaths}
                </span>
              </span>
              <span>
                <span className="text-white/35">Ratio</span>{" "}
                <span
                  className={
                    parseFloat(kd) > 1.0
                      ? "text-emerald-400"
                      : parseFloat(kd) < 1.0
                        ? "text-red-400/85"
                        : "text-white"
                  }
                >
                  {kd}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* CTA / chevron */}
        <div className="flex items-center pr-4 shrink-0">
          {!expanded ? (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                isAnalyzed
                  ? "bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/25 group-hover:bg-[#FF6B35]/20"
                  : "bg-white/[0.04] text-white/65 border border-white/[0.08] group-hover:bg-white/[0.08]"
              }`}
            >
              {isAnalyzed ? (
                <>
                  <Sparkles size={12} />
                  Editar reel
                </>
              ) : (
                <>
                  <ChevronDown size={12} />
                  Analisar
                </>
              )}
            </div>
          ) : (
            <ChevronUp size={16} className="text-[#FF6B35]" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.06] bg-[#0a0a12]/60">
          <ExpandedContent demo={demo} />
        </div>
      )}
    </div>
  );
}

// ── Expanded content (roster) ─────────────────────────────────────────────

function ExpandedContent({ demo }: { demo: LocalDemo }) {
  const router = useRouter();
  const [roster, setRoster] = useState<DemoRosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatars, setAvatars] = useState<AvatarMap>({});
  const fetchedAvatarsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await getDemoRoster(demo.sha1);
        if (cancelled) return;
        setRoster(r);
        if (!fetchedAvatarsRef.current && r.roster.length > 0) {
          fetchedAvatarsRef.current = true;
          void fetchAvatars(r.roster.map((p) => p.steamid));
        }
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo.sha1]);

  async function fetchAvatars(steamids: string[]) {
    try {
      const res = await fetch("/api/steam/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamids }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { avatars: AvatarMap };
      setAvatars((prev) => ({ ...prev, ...data.avatars }));
    } catch {
      // Silent fail — degrades pra initials.
    }
  }

  function handleSelectPlayer(steamid: string) {
    // Vai pro /demo/[sha] que dispara scoreDemoForPlayer + redirect /match/[id].
    // TODO próximo PR (Mathieu spec): trocar player inline no /match/[id]
    // header dropdown (em vez de re-selecionar aqui se já analisada).
    router.push(`/demo/${demo.sha1}?steamid=${steamid}`);
  }

  if (loading) {
    return (
      <div className="p-5 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-[#FF6B35]" />
        <span className="text-sm text-white/55">
          Carregando roster da partida...
        </span>
      </div>
    );
  }

  if (error || !roster) {
    return (
      <div className="p-5 flex items-center gap-3">
        <AlertCircle size={16} className="text-red-400" />
        <span className="text-sm text-red-400/85">
          {error || "Erro ao carregar roster"}
        </span>
      </div>
    );
  }

  const ct = roster.roster.filter((p) => p.team === 3);
  const t = roster.roster.filter((p) => p.team === 2);

  return (
    <div className="p-4 space-y-4">
      <div className="text-[11px] text-white/45 leading-relaxed">
        Escolha quem vai protagonizar o reel — kills, plays e momentos serão
        analisados sob a perspectiva desse jogador.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamColumn
          label="CT"
          color={TEAM_COLOR[3]}
          players={ct}
          avatars={avatars}
          onSelect={handleSelectPlayer}
        />
        <TeamColumn
          label="T"
          color={TEAM_COLOR[2]}
          players={t}
          avatars={avatars}
          onSelect={handleSelectPlayer}
        />
      </div>
    </div>
  );
}

function TeamColumn({
  label,
  color,
  players,
  avatars,
  onSelect,
}: {
  label: string;
  color: string;
  players: DemoRosterPlayer[];
  avatars: AvatarMap;
  onSelect: (steamid: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <div
          className="w-1 h-3 rounded-sm"
          style={{ background: color }}
        />
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </div>
        <div className="text-[10px] text-white/30">{players.length}</div>
      </div>
      <div className="space-y-1.5">
        {players.map((p) => (
          <PlayerRow
            key={p.steamid}
            player={p}
            avatarUrl={avatars[p.steamid]}
            teamColor={color}
            onClick={() => onSelect(p.steamid)}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  avatarUrl,
  teamColor,
  onClick,
}: {
  player: DemoRosterPlayer;
  avatarUrl: string | undefined;
  teamColor: string;
  onClick: () => void;
}) {
  const initials = (player.name || "??")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-white/[0.05] bg-white/[0.02] hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/[0.05] hover:shadow-[0_0_15px_rgba(255,107,53,0.1)] transition-all p-2.5 cursor-pointer flex items-center gap-3"
    >
      <div
        className="shrink-0 w-9 h-9 rounded-md overflow-hidden border-2"
        style={{ borderColor: teamColor + "60" }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={player.name || "player"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[10px] font-bold"
            style={{
              background: teamColor + "20",
              color: teamColor,
            }}
          >
            {initials}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-white truncate">
          {player.name || `Player ${player.steamid.slice(-4)}`}
        </div>
        <div className="text-[11px] text-white/45 font-mono mt-0.5">
          {player.kills}/{player.deaths} · {player.headshots} HS
        </div>
      </div>
      <Sparkles
        size={14}
        className="text-[#FF6B35]/60 group-hover:text-[#FF6B35] shrink-0"
      />
    </button>
  );
}

// ── States ────────────────────────────────────────────────────────────────

function SkeletonState() {
  return (
    <div className="space-y-3 mt-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-[100px] rounded-xl bg-white/[0.025] border border-white/[0.06] animate-pulse"
        />
      ))}
    </div>
  );
}

function InitializingState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="h-14 w-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
        <Loader2 size={28} className="text-amber-400 animate-spin" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Inicializando client...</h2>
      <p className="text-sm text-white/55 max-w-md">
        O FragReel acabou de abrir e tá fazendo o setup inicial. Demora ~5-15s
        na primeira execução do dia. A página atualiza sozinha quando terminar.
      </p>
    </div>
  );
}

function OfflineState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-7 text-center max-w-2xl mx-auto">
      <div className="h-14 w-14 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4 mx-auto">
        <AlertCircle size={26} className="text-orange-400" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Client FragReel não detectado</h2>
      <p className="text-sm text-white/55 max-w-md mx-auto mb-5">
        Pra ver suas demos, abra o FragReel no seu PC. Ele lê os .dem do CS2
        localmente — nada é enviado pra servidor sem confirmação.
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <DownloadButton className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90 transition-colors shadow-[0_4px_14px_rgba(255,107,53,0.25)]">
          <Download size={14} />
          Baixar / Reinstalar
        </DownloadButton>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw size={14} />
          Já está aberto · Recarregar
        </Button>
      </div>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="h-14 w-14 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertCircle size={28} className="text-red-400" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Erro ao carregar demos</h2>
      <p className="text-sm text-white/55 max-w-md mb-5 font-mono text-xs">
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw size={14} />
        Tentar de novo
      </Button>
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 max-w-2xl mx-auto">
      <div className="h-14 w-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
        <Trophy size={26} className="text-white/40" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Nenhuma demo detectada</h2>
      <p className="text-sm text-white/55 max-w-md mx-auto mb-6 leading-relaxed">
        FragReel lê os .dem que o CS2 salva quando você baixa uma partida do
        Watch tab. Demos importadas (HLTV/CSGOStats) também aparecem aqui.
      </p>
      <Button onClick={onImport}>
        <UploadCloud size={14} />
        Importar .dem manualmente
      </Button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function prettyMap(name: string): string {
  return (name || "")
    .replace(/^de_/, "")
    .replace(/^cs_/, "")
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
