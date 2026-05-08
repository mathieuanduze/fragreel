"use client";

/**
 * DemosAnalisadasClient — 2-panel UX (Sprint DEMO-3 v4, 08/05/2026).
 *
 * Mathieu spec literal:
 *   "as que já foram parseadas, à esquerda... à direita players
 *   envolvidos com suas fotos e jogadas de impacto de cada um.
 *   Selecionar player → CTA Editar FragReel"
 *
 * Data:
 *   - Esquerda: getLocalDemos() filtrado por match_id != null
 *   - Direita: getDemoRoster(sha) quando demo selected
 *   - Avatares: Steam Web API GetPlayerSummaries via Vercel route
 *     /api/steam/avatars (keep API key server-side)
 *
 * Click player → "Editar FragReel" CTA → scoreDemoForPlayer →
 * redirect /match/[id] (tela de edição existente).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import AppShell from "./AppShell";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar } from "./ui/avatar";
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

const TEAM_LABEL: Record<number, string> = { 2: "T", 3: "CT" };
const TEAM_COLOR: Record<number, string> = { 2: "#fbbf24", 3: "#5D9CEC" };

interface AvatarMap {
  [steamid: string]: string; // steamid → avatar URL
}

export default function DemosAnalisadasClient() {
  const router = useRouter();
  const clientVersion = useClientVersionStatus();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [demos, setDemos] = useState<LocalDemo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [roster, setRoster] = useState<DemoRosterResponse | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [avatars, setAvatars] = useState<AvatarMap>({});
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !user) router.push("/login");
  }, [hydrated, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(false);
    try {
      const r = await getLocalDemos(false);
      // Filtra só demos JÁ analisadas (match_id preenchido).
      const analisadas = r.matches.filter((d) => d.match_id);
      setDemos(analisadas);
      // Auto-select primeira demo se nenhuma selecionada
      if (analisadas.length > 0 && !selectedSha) {
        setSelectedSha(analisadas[0].sha1);
      }
    } catch (e) {
      if (e instanceof LocalClientOffline) setOffline(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated && user) void load();
  }, [hydrated, user, load]);

  // Auto-recover quando client volta online
  useEffect(() => {
    if (!offline) return;
    let alive = true;
    const id = setInterval(async () => {
      const ok = await pingLocalClient();
      if (alive && ok) {
        clearInterval(id);
        void load();
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [offline, load]);

  // Carrega roster da demo selecionada
  useEffect(() => {
    if (!selectedSha) {
      setRoster(null);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    setRosterError(null);
    setSelectedPlayer(null);
    (async () => {
      try {
        const r = await getDemoRoster(selectedSha);
        if (cancelled) return;
        setRoster(r);
        // Fetch avatars em paralelo (não bloqueia render do roster)
        void fetchAvatars(r.roster.map((p) => p.steamid));
      } catch (e) {
        if (cancelled) return;
        setRosterError((e as Error).message);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSha]);

  async function fetchAvatars(steamids: string[]) {
    if (steamids.length === 0) return;
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
      // Silent fail — UI degrada graciosamente pra initials.
    }
  }

  async function handleEditFragReel() {
    if (!selectedSha || !selectedPlayer) return;
    setEditing(true);
    try {
      // scoreDemoForPlayer já retorna match_doc — depois redirect /match/[id].
      // Se demo já tem highlights cached pra esse player, é fast-path (~1s).
      // Se não, IA roda (~30s). Aqui não esperamos retorno — deixa MatchClient
      // tratar via getMatch() + LocalMatchFetcher fallback.
      router.push(`/demo/${selectedSha}`);
    } catch (e) {
      console.error(e);
      setEditing(false);
    }
  }

  if (!hydrated || !user) {
    return (
      <AppShell>
        <SkeletonState />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Demos Analisadas"
      subtitle="Suas partidas processadas pela IA, prontas pra editar"
    >
      {offline ? (
        <OfflineState />
      ) : loading && !demos ? (
        <SkeletonState />
      ) : !demos || demos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 mt-1">
          {/* ── ESQUERDA: lista de demos analisadas ──────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35 px-1 mb-1">
              {demos.length} {demos.length === 1 ? "demo" : "demos"}
            </div>
            {demos.map((d) => (
              <DemoListItem
                key={d.sha1}
                demo={d}
                active={selectedSha === d.sha1}
                onClick={() => setSelectedSha(d.sha1)}
              />
            ))}
          </div>

          {/* ── DIREITA: roster + player kills ───────────────────── */}
          <div className="min-w-0">
            {rosterLoading && <RosterSkeleton />}
            {rosterError && (
              <Card className="p-6 text-center">
                <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400/85">{rosterError}</p>
              </Card>
            )}
            {!rosterLoading && !rosterError && roster && (
              <RosterPanel
                roster={roster}
                avatars={avatars}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={setSelectedPlayer}
                onEdit={handleEditFragReel}
                editing={editing}
              />
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── Demo list item ─────────────────────────────────────────────────────────

function DemoListItem({
  demo,
  active,
  onClick,
}: {
  demo: LocalDemo;
  active: boolean;
  onClick: () => void;
}) {
  const date = new Date(demo.mtime * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border transition-all p-3 cursor-pointer ${
        active
          ? "border-[#FF6B35]/50 bg-[#FF6B35]/[0.06]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-[10px] font-bold uppercase"
          style={{
            background: active
              ? "linear-gradient(135deg, #FF6B35 0%, #c2410c 100%)"
              : "rgba(255,107,53,0.15)",
            color: active ? "white" : "#FF6B35",
          }}
        >
          {demo.map_name.slice(0, 3)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate capitalize">
            {demo.map_name}
          </div>
          <div className="text-[11px] text-white/45 font-mono mt-0.5">
            {demo.score_ct}:{demo.score_t} · {date}
          </div>
        </div>
        {active && (
          <ArrowRight size={14} className="text-[#FF6B35] shrink-0" />
        )}
      </div>
    </button>
  );
}

// ── Roster panel ──────────────────────────────────────────────────────────

function RosterPanel({
  roster,
  avatars,
  selectedPlayer,
  onSelectPlayer,
  onEdit,
  editing,
}: {
  roster: DemoRosterResponse;
  avatars: AvatarMap;
  selectedPlayer: string | null;
  onSelectPlayer: (steamid: string) => void;
  onEdit: () => void;
  editing: boolean;
}) {
  const ct = roster.roster.filter((p) => p.team === 3);
  const t = roster.roster.filter((p) => p.team === 2);
  const others = roster.roster.filter((p) => p.team !== 2 && p.team !== 3);

  return (
    <div className="space-y-4">
      {/* Header da partida */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Trophy size={18} className="text-[#FF6B35]" />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white capitalize">
              {roster.map_name}
            </h3>
            <div className="text-xs text-white/50 font-mono mt-0.5">
              CT {roster.ct_score} · {roster.t_score} T · {roster.tickrate}tps
            </div>
          </div>
        </div>
      </Card>

      {/* CT team */}
      {ct.length > 0 && (
        <TeamPanel
          label="CT"
          players={ct}
          color={TEAM_COLOR[3]}
          avatars={avatars}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {/* T team */}
      {t.length > 0 && (
        <TeamPanel
          label="T"
          players={t}
          color={TEAM_COLOR[2]}
          avatars={avatars}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {others.length > 0 && (
        <TeamPanel
          label="Sem time"
          players={others}
          color="#888"
          avatars={avatars}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {/* CTA Editar FragReel */}
      <div className="sticky bottom-4 pt-2">
        <div className="rounded-xl border border-white/10 bg-[#0a0a12]/95 backdrop-blur-md p-3 flex items-center gap-3 shadow-xl">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/55">
              {selectedPlayer ? (
                <>
                  Editando reel de{" "}
                  <span className="text-white font-semibold">
                    {roster.roster.find((p) => p.steamid === selectedPlayer)
                      ?.name || selectedPlayer}
                  </span>
                </>
              ) : (
                "Selecione um player pra editar o FragReel dele"
              )}
            </div>
          </div>
          <Button
            disabled={!selectedPlayer || editing}
            onClick={onEdit}
            size="lg"
          >
            <Sparkles size={14} />
            {editing ? "Carregando..." : "Editar FragReel"}
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Team panel (CT ou T) ──────────────────────────────────────────────────

function TeamPanel({
  label,
  players,
  color,
  avatars,
  selectedPlayer,
  onSelectPlayer,
}: {
  label: string;
  players: DemoRosterPlayer[];
  color: string;
  avatars: AvatarMap;
  selectedPlayer: string | null;
  onSelectPlayer: (steamid: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </div>
        <div className="text-[10px] text-white/30">{players.length}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {players.map((p) => (
          <PlayerCard
            key={p.steamid}
            player={p}
            avatarUrl={avatars[p.steamid]}
            teamColor={color}
            active={selectedPlayer === p.steamid}
            onClick={() => onSelectPlayer(p.steamid)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────

function PlayerCard({
  player,
  avatarUrl,
  teamColor,
  active,
  onClick,
}: {
  player: DemoRosterPlayer;
  avatarUrl: string | undefined;
  teamColor: string;
  active: boolean;
  onClick: () => void;
}) {
  const initials = (player.name || "??")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const kd = player.deaths > 0 ? player.kills / player.deaths : player.kills;

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border transition-all p-2.5 cursor-pointer flex items-center gap-3 ${
        active
          ? "border-[#FF6B35]/60 bg-[#FF6B35]/[0.08] shadow-[0_0_0_1px_rgba(255,107,53,0.4)]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-md overflow-hidden border-2"
        style={{ borderColor: active ? "#FF6B35" : teamColor + "60" }}
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
            className="w-full h-full flex items-center justify-center text-xs font-bold"
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
        <div className="text-sm font-semibold text-white truncate">
          {player.name || `Player ${player.steamid.slice(-4)}`}
        </div>
        <div className="text-[11px] text-white/50 font-mono mt-0.5">
          {player.kills}/{player.deaths} · {player.headshots} HS · KD{" "}
          {kd.toFixed(2)}
        </div>
      </div>
    </button>
  );
}

// ── States ─────────────────────────────────────────────────────────────────

function SkeletonState() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 mt-1">
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-lg bg-white/[0.025] border border-white/[0.06] animate-pulse"
          />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-[64px] rounded-lg bg-white/[0.025] border border-white/[0.06] animate-pulse" />
        <div className="grid grid-cols-2 gap-2">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-[60px] rounded-lg bg-white/[0.025] border border-white/[0.06] animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-[64px] rounded-lg bg-white/[0.025] border border-white/[0.06] animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="h-[60px] rounded-lg bg-white/[0.025] border border-white/[0.06] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="h-12 w-12 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
        <Users size={20} className="text-white/40" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Nenhuma demo analisada ainda</h2>
      <p className="text-sm text-white/45 max-w-md mb-5">
        Vá em <span className="text-[#FF6B35]">Minhas Demos</span>, escolha
        uma demo e clique em &ldquo;Analisar&rdquo; — quando a IA terminar
        de processar, ela aparece aqui.
      </p>
    </div>
  );
}

function OfflineState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="h-14 w-14 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
        <AlertCircle size={28} className="text-orange-400" />
      </div>
      <h2 className="text-lg font-semibold mb-1.5">Client FragReel offline</h2>
      <p className="text-sm text-white/55 max-w-md">
        Inicie o cliente Windows pra ver suas demos analisadas.
      </p>
    </div>
  );
}
