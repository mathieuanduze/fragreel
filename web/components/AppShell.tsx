"use client";

/**
 * AppShell — sidebar layout (Sprint DEMO-3 v2 redesign).
 *
 * Mathieu spec (08/05/2026): "redesign não é só do sidebar, mas do UI
 * interno da plataforma logada. Tava parecendo muito de IA. Mistura cores
 * gamers (laranja, preto, azul) com Linear/Allstar polidez."
 *
 * Layout:
 *   ┌─────────┬───────────────────────────────────┐
 *   │ Sidebar │ Main content area                 │
 *   │ 220px   │                                   │
 *   │         │                                   │
 *   │ - Logo  │                                   │
 *   │ - Nav   │                                   │
 *   │ - Spacer│                                   │
 *   │ - User  │                                   │
 *   │   chip  │                                   │
 *   └─────────┴───────────────────────────────────┘
 *
 * Estilo: Linear (clean SaaS) + Discord (sidebar polidíssima) + Allstar
 * (gaming density). Paleta laranja CT primary + azul CT secondary.
 *
 * Substitui Nav.tsx top bar (que será depreciado em pages logadas).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Trophy,
  FolderClock,
  Settings,
  LogOut,
  Download,
  Zap,
  UploadCloud,
  Sparkles,
  Bug,
  Film,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getUser, logout, type SessionUser } from "@/lib/session";
import { useClientVersionStatus } from "@/lib/useClientVersionStatus";
import ClientStatusChip from "./ClientStatusChip";
import InstallingClientBanner from "./InstallingClientBanner";
import { getRecentRender } from "@/lib/recentRender";
import {
  getEditDrafts,
  clearEditDraft,
  editingForMinutes,
  type EditDraft,
} from "@/lib/editDraft";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string;
};

// Sprint v5.4 (08/05/2026 Mathieu spec): "quero seções fixas no sidebar".
// Nada conditional — sempre mostra os 4 itens. Estados vazios handled
// pela page destino (empty state com CTA pra começar).
//
// Edição em andamento (EditDraft) renderizada como NavLink especial
// entre Minhas Demos e Meus FragReels com indicador laranja pulsante
// quando há draft.
const NAV_PRIMARY: NavItem[] = [
  { href: "/matches",  label: "Minhas Demos",   icon: FolderClock },
  { href: "/renders",  label: "Meus FragReels", icon: Film },
];

const NAV_SECONDARY: NavItem[] = [
  { href: "/report-bug",    label: "Reportar Bug",     icon: Bug },
];

interface AppShellProps {
  children: React.ReactNode;
  /** Page title shown in topbar (above main) */
  title?: string;
  /** Page subtitle / description */
  subtitle?: string;
  /** Right-side action buttons (ex: "Refresh", "New") */
  topbarActions?: React.ReactNode;
}

export default function AppShell({
  children,
  title,
  subtitle,
  topbarActions,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [hasRecentRender, setHasRecentRender] = useState(false);
  const [editDrafts, setEditDraftsState] = useState<EditDraft[]>([]);
  const clientStatus = useClientVersionStatus();

  useEffect(() => {
    setUser(getUser());
    setHasRecentRender(getRecentRender() !== null);
    setEditDraftsState(getEditDrafts());
    setHydrated(true);
    const onFocus = () => {
      setUser(getUser());
      setHasRecentRender(getRecentRender() !== null);
      setEditDraftsState(getEditDrafts());
    };
    const onEditDraftChange = () => setEditDraftsState(getEditDrafts());
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    window.addEventListener("editDraft:change", onEditDraftChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
      window.removeEventListener("editDraft:change", onEditDraftChange);
    };
  }, []);

  // Re-check recent render every 60s (TTL é 1h, granularidade fina não importa)
  useEffect(() => {
    const id = setInterval(() => {
      setHasRecentRender(getRecentRender() !== null);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  function handleDiscardEdit(matchId: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (
        confirm("Descartar essa edição? Os ajustes feitos serão perdidos.")
      ) {
        clearEditDraft(matchId);
        // Se estiver na própria page de edição descartada, navega pra
        // Minhas Demos pra evitar ficar com page sem context.
        if (pathname === `/match/${matchId}`) {
          router.push("/matches");
        }
      }
    };
  }

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--color-background))] text-[rgb(var(--color-foreground))] flex">
      {/* Install banner global (top, fixed) */}
      {clientStatus.status === "installing" && (
        <InstallingClientBanner
          secondsElapsed={clientStatus.installingForSec ?? 0}
          installStatus={clientStatus.installStatus}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden md:flex w-[220px] flex-col border-r border-white/[0.06] bg-[rgb(var(--color-card))]/40 backdrop-blur-md"
        aria-label="Navegação principal"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 px-5 h-[60px] border-b border-white/[0.04] hover:opacity-80 transition-opacity"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgb(var(--color-primary))] text-white">
            <Zap size={16} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-base tracking-tight">
            <span className="text-[rgb(var(--color-primary))]">FRAG</span>REEL
          </span>
        </Link>

        {/* Nav primary */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--color-muted-foreground))]">
            Plataforma
          </div>
          {/* Sprint v5.4 (Mathieu spec): "quero seções fixas no sidebar".
              Render Minhas Demos sempre. Editando FragReel sempre — fade
              quando não há draft, laranja pulsante quando há. Meus
              FragReels sempre — page destino mostra empty state. */}
          <NavLink
            item={NAV_PRIMARY[0]}
            active={pathname === NAV_PRIMARY[0].href}
          />

          {/* Editando FragReel — fixo, mostra 1-3 drafts ativos.
              Quando vazio: 1 item disabled "Editar FragReel · Nenhum".
              Quando há drafts: N items laranja pulsantes (max 3) com X. */}
          {!hydrated || editDrafts.length === 0 ? (
            <EditDraftItem
              draft={null}
              active={false}
              onDiscard={() => {}}
            />
          ) : (
            editDrafts.map((d) => (
              <EditDraftItem
                key={d.matchId}
                draft={d}
                active={pathname === `/match/${d.matchId}`}
                onDiscard={handleDiscardEdit(d.matchId)}
              />
            ))
          )}

          {/* Meus FragReels — fixo, com badge "Novo" se há render < 1h */}
          <NavLink
            item={{
              ...NAV_PRIMARY[1],
              badge: hydrated && hasRecentRender ? "Novo" : undefined,
            }}
            active={pathname === NAV_PRIMARY[1].href}
          />

          {NAV_SECONDARY.length > 0 && (
            <>
              <div className="px-2 mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--color-muted-foreground))]">
                Suporte
              </div>
              {NAV_SECONDARY.map((item) => (
                <NavLink key={item.href} item={item} active={pathname === item.href} />
              ))}
            </>
          )}
        </nav>

        {/* Client status indicator + User chip */}
        <div className="px-3 py-3 border-t border-white/[0.04] space-y-3">
          <ClientStatusBlock status={clientStatus.status} version={clientStatus.local} />
          {hydrated && user && (
            <UserBlock user={user} onLogout={handleLogout} />
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <main className="flex-1 md:ml-[220px] min-h-screen">
        {/* Topbar — DEMO-3 v4: Mathieu pediu manter o ClientStatusChip do
            topo da página (antes vivia em Nav.tsx). Mostra status: checking
            / Client conectado vN / Atualizar / Baixar client. Aparece
            sempre, mesmo em pages sem title/topbarActions. */}
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[rgb(var(--color-background))]/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-6 lg:px-8 h-[60px] gap-4">
            <div className="min-w-0 flex-1">
              {title && (
                <h1 className="text-lg font-bold tracking-tight text-[rgb(var(--color-foreground))]">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-[rgb(var(--color-muted-foreground))] truncate">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ClientStatusChip />
              {topbarActions && (
                <div className="flex items-center gap-2">{topbarActions}</div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px]">
          {children}
        </div>
      </main>

      {/* Mobile nav backdrop / collapse — TODO Sprint UX-5b */}
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
        active
          ? "bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))]"
          : "text-[rgb(var(--color-foreground))]/65 hover:bg-white/[0.03] hover:text-[rgb(var(--color-foreground))]",
      )}
    >
      <Icon
        size={15}
        className={cn(
          "shrink-0",
          active
            ? "text-[rgb(var(--color-primary))]"
            : "text-[rgb(var(--color-foreground))]/50 group-hover:text-[rgb(var(--color-foreground))]/80",
        )}
      />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto text-[9px] font-bold tracking-wider bg-[rgb(var(--color-primary))]/15 text-[rgb(var(--color-primary))] px-1.5 py-0.5 rounded">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/**
 * EditDraftItem — sidebar item FIXO pra edição.
 *
 * Sprint v5.4 (08/05/2026 Mathieu spec): "quero seções fixas no sidebar".
 * Renderiza sempre — quando não há draft, fica em estado fade/disabled
 * com label "Editar FragReel" (não-clickable, sem destino). Quando há
 * draft, vira laranja pulsante "Editando: <Map>" + "há Xmin" + X
 * pra descartar.
 */
function EditDraftItem({
  draft,
  active,
  onDiscard,
}: {
  draft: EditDraft | null;
  active: boolean;
  onDiscard: (e: React.MouseEvent) => void;
}) {
  // ── Estado vazio: fade/disabled, sem destino ──
  if (!draft) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
          "text-[rgb(var(--color-foreground))]/30 cursor-default",
        )}
        title="Nenhuma edição em andamento. Vá em Minhas Demos pra começar."
      >
        <Pencil
          size={15}
          className="shrink-0 text-[rgb(var(--color-foreground))]/30"
        />
        <span className="truncate">Editar FragReel</span>
        <span className="ml-auto text-[9px] text-[rgb(var(--color-foreground))]/35 italic">
          Nenhum
        </span>
      </div>
    );
  }

  // ── Estado ativo: laranja pulsante com discard X ──
  const minutes = editingForMinutes(draft);
  const mapPretty =
    draft.mapName.replace(/^de_/, "").charAt(0).toUpperCase() +
    draft.mapName.replace(/^de_/, "").slice(1);

  return (
    <Link
      href={`/match/${draft.matchId}`}
      className={cn(
        "group relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all border",
        active
          ? "bg-[rgb(var(--color-primary))]/15 text-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]/30"
          : "bg-[rgb(var(--color-primary))]/[0.05] text-[rgb(var(--color-primary))]/85 border-[rgb(var(--color-primary))]/15 hover:bg-[rgb(var(--color-primary))]/10 hover:border-[rgb(var(--color-primary))]/25",
      )}
    >
      <div className="relative shrink-0">
        <Pencil size={15} className="text-[rgb(var(--color-primary))]" />
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-primary))] animate-pulse" />
      </div>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="truncate text-[13px] font-semibold">
          Editando: {mapPretty}
        </div>
        <div className="text-[10px] text-[rgb(var(--color-primary))]/65 font-normal">
          {minutes < 1 ? "iniciado agora" : `há ${minutes}min`}
        </div>
      </div>
      <button
        onClick={onDiscard}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-[rgb(var(--color-primary))]/55 hover:text-[rgb(var(--color-primary))] transition-colors"
        title="Descartar edição"
      >
        <X size={11} />
      </button>
    </Link>
  );
}

function ClientStatusBlock({
  status,
  version,
}: {
  status: string;
  version: string | null;
}) {
  const config = {
    checking:   { dot: "bg-white/30 animate-pulse", label: "Verificando…", color: "text-white/40" },
    current:    { dot: "bg-emerald-400", label: "Conectado", color: "text-emerald-400" },
    outdated:   { dot: "bg-amber-400", label: "Atualizar", color: "text-amber-400" },
    offline:    { dot: "bg-[rgb(var(--color-primary))]", label: "Offline", color: "text-[rgb(var(--color-primary))]" },
    installing: { dot: "bg-[rgb(var(--color-primary))] animate-pulse", label: "Instalando…", color: "text-[rgb(var(--color-primary))]" },
  } as const;

  const cfg = config[status as keyof typeof config] || config.checking;

  if (status === "offline") {
    return (
      <Link
        href="/download"
        className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[rgb(var(--color-primary))]/10 border border-[rgb(var(--color-primary))]/20 hover:bg-[rgb(var(--color-primary))]/15 transition-colors"
      >
        <Download size={14} className="text-[rgb(var(--color-primary))]" />
        <span className="text-[12px] font-semibold text-[rgb(var(--color-primary))]">
          Baixar client
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 text-[11px]">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      <span className={cn("font-medium", cfg.color)}>
        {cfg.label}
      </span>
      {version && (
        <span className="ml-auto font-mono text-[10px] text-white/40">
          {version}
        </span>
      )}
    </div>
  );
}

function UserBlock({
  user,
  onLogout,
}: {
  user: SessionUser;
  onLogout: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors group">
      <Avatar src={user.avatar} fallback={user.name} size={28} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold truncate">{user.name}</div>
        <div className="text-[10px] text-white/35 font-mono truncate">
          Steam connected
        </div>
      </div>
      <button
        onClick={onLogout}
        aria-label="Sair"
        className="p-1.5 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
