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

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Download,
  ChevronUp,
  Sparkles,
  Trophy,
  AlertCircle,
  UploadCloud,
  Loader2,
} from "lucide-react";
import AppShell from "./AppShell";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import DownloadButton from "./DownloadButton";
import ImportDemoModal from "./ImportDemoModal";
import AnalyzingDemoModal from "./AnalyzingDemoModal";
import MinhasDemosOnboarding from "./MinhasDemosOnboarding";
import {
  getLocalDemos,
  getDemoRoster,
  scoreDemoForPlayer,
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

// ── Demo expiry semáforo (ported from LibraryContent) ─────────────────────
// Demos do Steam matchmaking expiram na Valve em 7-14 dias. User precisa
// saber se ainda dá pra re-baixar. Heurística baseada em mtime do file.
type ExpiryStatus = "green" | "yellow" | "red";

function expiryStatus(epoch: number): {
  status: ExpiryStatus;
  label: string;
  days: number;
} {
  const ageDays = Math.floor((Date.now() - epoch * 1000) / 86_400_000);
  if (ageDays < 5) {
    return { status: "green", label: "Disponível na Valve", days: ageDays };
  }
  if (ageDays < 13) {
    const remaining = Math.max(1, 13 - ageDays);
    return {
      status: "yellow",
      label: `Expira em ~${remaining}d`,
      days: ageDays,
    };
  }
  return {
    status: "red",
    label: "Provavelmente expirou",
    days: ageDays,
  };
}

const EXPIRY_COLORS: Record<
  ExpiryStatus,
  { bg: string; border: string; text: string }
> = {
  green: { bg: "rgba(91,227,143,0.12)", border: "rgba(91,227,143,0.45)", text: "#5be38f" },
  yellow: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.45)", text: "#fbbf24" },
  red: { bg: "rgba(255,107,53,0.12)", border: "rgba(255,107,53,0.45)", text: "#ff6b35" },
};

export default function MinhasDemosClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [demos, setDemos] = useState<LocalDemo[] | null>(null);
  const [status, setStatus] = useState<Status>("skeleton");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const clientVersion = useClientVersionStatus();
  const lastLocalVersionRef = useRef<string | null>(null);

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

  // Sprint v5.7.8 (Mathieu spec 08/05/2026): "Quando instala o client
  // novo e ele atualiza, nao da um autorefresh nas demos e vem a mensagem
  // demo_not_found. Quando atualizo manual, fica tudo certo, mas deveria
  // ser automatico."
  //
  // Detecta transição de versão do client local (auto-update completou)
  // e força refresh=true do scanner pra invalidar cache stale de SHAs
  // pre-update. Espelha behavior do LibraryContent (sprint v0.2.11).
  useEffect(() => {
    const prev = lastLocalVersionRef.current;
    const curr = clientVersion.local;
    // Só reaja a mudança real prev→curr com curr definido. Ignora
    // primeiro tick (prev null + curr null = boot).
    if (curr && prev && prev !== curr) {
      void load(true);
    }
    lastLocalVersionRef.current = curr;
  }, [clientVersion.local, load]);

  // Sprint v5.1 (Mathieu spec): "não acho que faça sentido a tag analisada
  // e pendente, ali faz sentido aquela informação de vencimento da demo".
  // Sem filter tabs — lista única ordenada por mtime desc (já vem assim
  // do backend). Status "analisada/pendente" reflete só no CTA do card.

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
          {/* Sprint v5.7.9 — onboarding banner pra primeira visita.
              Some sozinho via flag localStorage após X dismiss. */}
          <MinhasDemosOnboarding />

          {/* Stats line — substituting filter tabs */}
          <div className="text-[11px] text-white/45 mb-4 px-1 flex items-center gap-3">
            <span>
              <span className="text-white/80 font-semibold">{demos.length}</span>{" "}
              {demos.length === 1 ? "demo" : "demos"} no seu PC
            </span>
            <span className="text-white/20">·</span>
            <span>
              ordenadas pelas mais recentes
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {demos.map((d) => (
              <DemoCard
                key={d.sha1}
                demo={d}
                expanded={expanded === d.sha1}
                onToggle={() =>
                  setExpanded(expanded === d.sha1 ? null : d.sha1)
                }
              />
            ))}
          </div>
        </>
      )}

      {importOpen && <ImportDemoModal onClose={() => setImportOpen(false)} />}
    </AppShell>
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

  // Sprint v5.7.12 (Mathieu spec 09/05/2026): "as demos que o user
  // faz upload, poderiam ser taggadas como uploaded, ou, se o user
  // logado, não participa da .dem=upload".
  //
  // Heurística: LocalDemo.player_kills + player_deaths são filtrados
  // pelo steamid do user logado no parser (parsed.player_kills só
  // inclui kills onde attacker_steamid === user_steamid). Se ambos
  // são 0 numa partida com rounds reais, user não estava na demo →
  // é upload (HLTV/CSGOStats/FACEIT/Pro demo).
  //
  // Edge cases tolerados:
  //   - User joinou late e morreu zero vezes (raro): falso positivo.
  //     Aceitável — pelo menos sinal "esta demo é diferente"
  //   - Spectator real: também pareceria upload. Spec edge case raro
  //     em workflow normal de player que loga + joga.
  const isUploadDemo =
    demo.player_kills === 0 &&
    demo.player_deaths === 0 &&
    totalRounds >= 5;

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
            {/* Sprint v5.1 (Mathieu spec): badge de vencimento Valve em vez de
                "Analisada/Pendente". Status verde/amarelo/vermelho semáforo
                baseado em age da demo (Valve expira em ~7-14d). */}
            <ExpiryBadge mtime={demo.mtime} />
            {/* Sprint v5.7.12 (Mathieu): badge "📥 Importada" pra demos
                onde user não participou (heurística player_kills+deaths=0). */}
            {isUploadDemo && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/[0.10] border border-violet-500/30 px-1.5 py-0.5 rounded"
                title="Você não participou desta partida — provavelmente importou de fora (HLTV/CSGOStats/FACEIT)"
              >
                📥 Importada
              </span>
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
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/25 group-hover:bg-[#FF6B35]/20"
            >
              <Sparkles size={12} />
              Mapear players
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
  // Player atualmente sendo analisado (post-click). Mostra Loader2 nele.
  const [analyzingSteamid, setAnalyzingSteamid] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
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

  async function handleSelectPlayer(steamid: string) {
    // Sprint v5.1 (Mathieu spec): "Mata a página escolha o player pois ele
    // já foi escolhido na última página. Vai direto pra página Mapeando
    // plays de impacto → /Demo".
    //
    // Antes: redirect /demo/[sha]?steamid=X → re-roster picker → score → /match/[id]
    // Agora: scoreDemoForPlayer direto + redirect /match/[id] (1 hop só).
    setAnalyzingSteamid(steamid);
    setAnalyzeError(null);
    try {
      const result = (await scoreDemoForPlayer(demo.sha1, steamid)) as {
        match_id?: string;
        id?: string;
      };
      const matchId = result.match_id || result.id;
      if (!matchId) {
        throw new Error("Backend não retornou match_id");
      }
      router.push(`/match/${matchId}`);
    } catch (e) {
      setAnalyzeError((e as Error).message);
      setAnalyzingSteamid(null);
    }
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

  // Player atualmente sendo analisado (pra mostrar AnalyzingDemoModal full-screen)
  const analyzingPlayer = analyzingSteamid
    ? roster?.roster.find((p) => p.steamid === analyzingSteamid)
    : null;

  return (
    <div className="p-4 space-y-4">
      <div className="text-[11px] text-white/45 leading-relaxed">
        Escolha quem vai protagonizar o reel — kills, plays e momentos serão
        analisados sob a perspectiva desse jogador.
      </div>

      {analyzeError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 font-mono">
          {analyzeError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamColumn
          label="CT"
          color={TEAM_COLOR[3]}
          players={ct}
          avatars={avatars}
          analyzingSteamid={analyzingSteamid}
          onSelect={handleSelectPlayer}
        />
        <TeamColumn
          label="T"
          color={TEAM_COLOR[2]}
          players={t}
          avatars={avatars}
          analyzingSteamid={analyzingSteamid}
          onSelect={handleSelectPlayer}
        />
      </div>

      {/* Sprint v5.5 (Mathieu spec): "Mate a página do re-mapeando kills
          de impacto. Tem que ser: Analisando demo do ponto de vista do
          [player name], tem que ter espaço pra ad". Modal full-screen
          enquanto scoreDemoForPlayer roda (5-30s). */}
      {analyzingPlayer && (
        <AnalyzingDemoModal
          playerName={
            analyzingPlayer.name ||
            `Player ${analyzingPlayer.steamid.slice(-4)}`
          }
          playerAvatar={avatars[analyzingPlayer.steamid]}
          mapName={demo.map_name}
        />
      )}
    </div>
  );
}

function TeamColumn({
  label,
  color,
  players,
  avatars,
  analyzingSteamid,
  onSelect,
}: {
  label: string;
  color: string;
  players: DemoRosterPlayer[];
  avatars: AvatarMap;
  analyzingSteamid: string | null;
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
            analyzing={analyzingSteamid === p.steamid}
            disabled={analyzingSteamid !== null && analyzingSteamid !== p.steamid}
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
  analyzing,
  disabled,
  onClick,
}: {
  player: DemoRosterPlayer;
  avatarUrl: string | undefined;
  teamColor: string;
  analyzing: boolean;
  disabled: boolean;
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
      disabled={disabled || analyzing}
      className={`w-full text-left rounded-lg border transition-all p-2.5 flex items-center gap-3 ${
        analyzing
          ? "border-[#FF6B35]/60 bg-[#FF6B35]/[0.10] shadow-[0_0_20px_rgba(255,107,53,0.2)] cursor-wait"
          : disabled
            ? "border-white/[0.04] bg-white/[0.01] opacity-40 cursor-not-allowed"
            : "border-white/[0.05] bg-white/[0.02] hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/[0.05] hover:shadow-[0_0_15px_rgba(255,107,53,0.1)] cursor-pointer"
      }`}
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
      {analyzing ? (
        <Loader2 size={14} className="animate-spin text-[#FF6B35] shrink-0" />
      ) : (
        <Sparkles
          size={14}
          className="text-[#FF6B35]/60 group-hover:text-[#FF6B35] shrink-0"
        />
      )}
    </button>
  );
}

// ── ExpiryBadge ───────────────────────────────────────────────────────────

function ExpiryBadge({ mtime }: { mtime: number }) {
  const exp = expiryStatus(mtime);
  const palette = EXPIRY_COLORS[exp.status];
  return (
    <span
      title={`Demo de ${exp.days}d atrás · janela Valve ~7-14d`}
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: palette.text,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        padding: "3px 8px",
        borderRadius: 999,
        letterSpacing: "0.04em",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: palette.text,
          boxShadow: `0 0 6px ${palette.text}`,
          flexShrink: 0,
        }}
      />
      {exp.label}
    </span>
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
      <p className="text-sm text-white/55 max-w-md mx-auto mb-3">
        Pra ver suas demos, abra o FragReel no seu PC. Ele lê os .dem do CS2
        localmente — nada é enviado pra servidor sem confirmação.
      </p>
      {/* Sprint v5.7.11 (Mathieu spec): "deixe claro que o fragreel só
          funciona em PC Windows com CS instalado". Note explícito antes
          do CTA pra não deixar Mac/Linux user perdido. */}
      <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-400/85 bg-amber-500/[0.06] border border-amber-500/20 rounded-md px-2.5 py-1 mb-5">
        <span>🪟</span>
        <span>
          Requer <strong className="text-amber-400">Windows 10/11</strong> +
          CS2 instalado
        </span>
      </div>
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
  // Sprint v5.7.9 (Mathieu spec): empty state autoexplicativo —
  // user precisa entender QUE elas vêm de DOWNLOAD manual no CS2.
  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="text-center mb-7">
        <div className="h-14 w-14 mx-auto rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
          <Trophy size={26} className="text-white/40" />
        </div>
        <h2 className="text-lg font-semibold mb-1.5">
          Nenhuma demo no seu PC ainda
        </h2>
        <p className="text-sm text-white/55 max-w-md mx-auto leading-relaxed">
          O FragReel só lê demos que <strong className="text-white/85">VOCÊ baixou</strong>.
          Você tem 2 jeitos de adicionar:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Path 1 — CS2 Watch */}
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xl">🎮</div>
            <h3 className="text-sm font-bold text-white">
              Suas próprias matches
            </h3>
          </div>
          <ol className="text-[12.5px] text-white/65 leading-relaxed space-y-1.5 ml-0.5">
            <li>
              <span className="text-emerald-400 font-semibold">1.</span> Abra o
              CS2
            </li>
            <li>
              <span className="text-emerald-400 font-semibold">2.</span> Vai em{" "}
              <span className="text-white/85">Watch → Your Matches</span>
            </li>
            <li>
              <span className="text-emerald-400 font-semibold">3.</span> Clique{" "}
              <span className="text-white/85">Download</span> na partida que
              você quer
            </li>
            <li>
              <span className="text-emerald-400 font-semibold">4.</span> Volta
              aqui — aparece sozinha
            </li>
          </ol>
        </div>

        {/* Path 2 — Import HLTV/CSGOStats */}
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xl">📥</div>
            <h3 className="text-sm font-bold text-white">
              Demo de pro player
            </h3>
          </div>
          <p className="text-[12.5px] text-white/65 leading-relaxed mb-3">
            Baixou uma .dem do HLTV, CSGOStats ou FACEIT? Importa direto.
          </p>
          <Button onClick={onImport} size="sm" variant="outline">
            <UploadCloud size={13} />
            Importar .dem
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-white/35 text-center mt-5 max-w-md mx-auto">
        Importante: não pegamos suas últimas matches automaticamente — só
        as que você baixou.
      </p>
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
