"use client";

/**
 * MatchCard — visual estilo Allstar.gg pra match history.
 *
 * Sprint DEMO-3 Sprint 4 (08/05/2026).
 *
 * Layout (paridade Allstar):
 *   [Mapa thumb colorido]  [Score · Mode · K/D · HS · Date]  [Status]  [→]
 *
 * Status indicator (badge top-right do thumb):
 *   🟢 demo já baixada (FragReel detectou em csgo/replays/)
 *   🟡 disponível na CDN Valve (clique = download automatic)
 *   🔴 expirou (>30d, demo não é mais downloadable)
 *
 * Click → navega pro flow render (sprint 5: side panel com roster + 2 CTAs).
 */

import { useRouter } from "next/navigation";

// CS2 maps coloring (paleta inspirada CS2 vanilla)
const MAP_COLORS: Record<string, { bg: string; accent: string; label: string }> = {
  mirage:    { bg: "linear-gradient(135deg, #C8A876 0%, #1a1410 70%)", accent: "#E8C896", label: "Mirage" },
  inferno:   { bg: "linear-gradient(135deg, #B85C2E 0%, #1a0e08 70%)", accent: "#FF6B35", label: "Inferno" },
  dust2:     { bg: "linear-gradient(135deg, #C9A857 0%, #1a1408 70%)", accent: "#E8D068", label: "Dust 2" },
  nuke:      { bg: "linear-gradient(135deg, #5A8FA8 0%, #0a1418 70%)", accent: "#7BB0CC", label: "Nuke" },
  ancient:   { bg: "linear-gradient(135deg, #5A8C5A 0%, #0a1410 70%)", accent: "#7CB07C", label: "Ancient" },
  anubis:    { bg: "linear-gradient(135deg, #C8995A 0%, #1a1408 70%)", accent: "#E8B868", label: "Anubis" },
  vertigo:   { bg: "linear-gradient(135deg, #7A7A8A 0%, #14141a 70%)", accent: "#A0A0B0", label: "Vertigo" },
  overpass:  { bg: "linear-gradient(135deg, #8A6A4E 0%, #14100a 70%)", accent: "#B0886A", label: "Overpass" },
  train:     { bg: "linear-gradient(135deg, #7A6E5E 0%, #14110d 70%)", accent: "#9A8E7E", label: "Train" },
  cache:     { bg: "linear-gradient(135deg, #9A6E5E 0%, #14110d 70%)", accent: "#B98E7E", label: "Cache" },
  cobblestone:{bg: "linear-gradient(135deg, #8E7A5E 0%, #14110d 70%)", accent: "#AE9A7E", label: "Cobble" },
  default:   { bg: "linear-gradient(135deg, rgba(255,107,53,0.10) 0%, #0d0d18 70%)", accent: "#FF8E53", label: "" },
};

function getMapStyle(mapName: string | undefined | null) {
  if (!mapName) return MAP_COLORS.default;
  const key = mapName.toLowerCase().replace(/^de_/, "");
  return MAP_COLORS[key] || { ...MAP_COLORS.default, label: mapName.replace(/^de_/, "") };
}

export type MatchStatus = "downloaded" | "available" | "expired" | "unknown";

export interface MatchCardData {
  /** ID estável (sharecode ou match_id) */
  id: string;
  /** Map name ex: "de_mirage" OU "mirage" */
  mapName?: string;
  /** Score "13:11" formato */
  score?: string;
  /** "Competitive" | "Premier" | "Wingman" | "Casual" */
  mode?: string;
  /** Player K/D ex: "15/16" */
  kd?: string;
  /** HS count */
  hsCount?: number;
  /** Unix timestamp ms */
  matchTime?: number;
  /** Demo URL (se disponível CDN Valve) */
  demoUrl?: string | null;
  /** Status — calculado em runtime ou fornecido */
  status?: MatchStatus;
  /** Win/Lose/Tie */
  outcome?: "win" | "loss" | "tie" | null;
}

type Props = {
  match: MatchCardData;
  onClick?: () => void;
};

export default function MatchCard({ match, onClick }: Props) {
  const router = useRouter();
  const mapStyle = getMapStyle(match.mapName);
  const dateLabel = match.matchTime ? formatRelativeTime(match.matchTime) : "—";

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    // Default: navigate pra match detail (sprint 5 implementa)
    // MVP: passa sharecode/id pro render flow
    if (match.id) {
      router.push(`/matches/${encodeURIComponent(match.id)}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 16,
        alignItems: "center",
        padding: 14,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,107,53,0.05)";
        e.currentTarget.style.borderColor = "rgba(255,107,53,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.025)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Map thumbnail */}
      <div
        style={{
          width: 110,
          height: 64,
          borderRadius: 6,
          background: mapStyle.bg,
          border: `1px solid ${mapStyle.accent}30`,
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Map name label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.10em",
            color: mapStyle.accent,
            textTransform: "uppercase",
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          }}
        >
          {mapStyle.label || "MAP"}
        </div>

        {/* Status indicator (top-right corner) */}
        <StatusDot status={match.status || "unknown"} />
      </div>

      {/* Center info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: outcomeColor(match.outcome),
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.02em",
            }}
          >
            {match.score || "—:—"}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.50)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {match.mode || "Unknown"}
          </span>
          {match.outcome && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 3,
                color: outcomeColor(match.outcome),
                background: `${outcomeColor(match.outcome)}15`,
                border: `1px solid ${outcomeColor(match.outcome)}30`,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {match.outcome}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.02em",
          }}
        >
          {match.kd && <span>KD {match.kd}</span>}
          {typeof match.hsCount === "number" && match.hsCount > 0 && <span>{match.hsCount} HS</span>}
          <span>{dateLabel}</span>
        </div>
      </div>

      {/* Right CTA arrow */}
      <div
        style={{
          fontSize: 18,
          color: "rgba(255,107,53,0.55)",
          fontWeight: 700,
          flexShrink: 0,
          paddingRight: 4,
        }}
      >
        →
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: MatchStatus }) {
  const config: Record<MatchStatus, { color: string; tooltip: string }> = {
    downloaded: { color: "#5be38f", tooltip: "Demo já baixada" },
    available:  { color: "#FFC107", tooltip: "Disponível pra download (CDN Valve)" },
    expired:    { color: "#dc2626", tooltip: "Expirou (>30d)" },
    unknown:    { color: "rgba(255,255,255,0.30)", tooltip: "Status desconhecido" },
  };
  const { color, tooltip } = config[status];
  return (
    <div
      title={tooltip}
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}80`,
      }}
    />
  );
}

function outcomeColor(outcome: MatchCardData["outcome"]) {
  if (outcome === "win") return "#5be38f";
  if (outcome === "loss") return "#FFB088";
  if (outcome === "tie") return "rgba(255,255,255,0.65)";
  return "rgba(255,255,255,0.85)";
}

function formatRelativeTime(unixMs: number): string {
  const now = Date.now();
  const diffSec = Math.max(0, (now - unixMs) / 1000);
  if (diffSec < 60) return "agora";
  const diffMin = diffSec / 60;
  if (diffMin < 60) return `${Math.floor(diffMin)}min atrás`;
  const diffHour = diffMin / 60;
  if (diffHour < 24) return `${Math.floor(diffHour)}h atrás`;
  const diffDay = diffHour / 24;
  if (diffDay < 30) return `${Math.floor(diffDay)}d atrás`;
  return `${Math.floor(diffDay / 30)}mo atrás`;
}
