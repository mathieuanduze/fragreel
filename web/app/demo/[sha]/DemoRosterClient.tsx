"use client";

/**
 * Sprint #7 Phase 7.2 — Roster picker unified.
 *
 * Substitui /pro/[sha]/ProRosterClient. Mesmo design visual + funcional.
 * Player picked → "Mapear plays de impacto" CTA → Phase 7.3+ wire (Ad +
 * score override + highlights + render). MVP atual: alert placeholder.
 */
import { useEffect, useState } from "react";
import {
  getDemoRoster,
  type DemoRosterPlayer,
  type DemoRosterResponse,
} from "@/lib/local";

const TEAM_LABEL: Record<number, string> = { 2: "T", 3: "CT" };
const TEAM_COLOR: Record<number, string> = { 2: "#fbbf24", 3: "#60a5fa" };

export default function DemoRosterClient({ sha }: { sha: string }) {
  const [data, setData] = useState<DemoRosterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<DemoRosterPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await getDemoRoster(sha);
        if (!cancelled) setData(resp);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [sha]);

  if (error) {
    return (
      <div style={{ padding: 16, background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.3)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
        Falha ao parsear demo: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Parseando demo... (5-15s pra demo grande)
      </div>
    );
  }

  return (
    <>
      {/* Match metadata */}
      <div style={{
        padding: "16px 20px",
        background: "#1A1A2E",
        border: "1px solid #2D2D44",
        borderRadius: 10,
        marginBottom: 24,
        display: "flex",
        gap: 32,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
            Mapa
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {data.map_name?.replace(/^de_/, "").toUpperCase() || "?"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
            Placar
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            <span style={{ color: TEAM_COLOR[3] }}>CT {data.ct_score}</span>
            {" — "}
            <span style={{ color: TEAM_COLOR[2] }}>{data.t_score} T</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
            Tickrate
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{data.tickrate}</div>
        </div>
      </div>

      {/* Roster grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {data.roster.map((p, idx) => {
          const isPicked = picked?.steamid === p.steamid;
          const teamLabel = p.team !== null ? TEAM_LABEL[p.team] : null;
          const teamColor = p.team !== null ? TEAM_COLOR[p.team] : "#666";
          const hsRate = p.kills > 0 ? Math.round((p.headshots / p.kills) * 100) : 0;
          return (
            <button
              key={p.steamid}
              onClick={() => setPicked(p)}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                background: isPicked ? "rgba(255,107,53,0.12)" : "#1A1A2E",
                border: isPicked ? "2px solid #FF6B35" : "1px solid #2D2D44",
                borderRadius: 10,
                cursor: "pointer",
                color: "inherit",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                  #{idx + 1}
                </div>
                {teamLabel && (
                  <div style={{ fontSize: 10, fontWeight: 800, color: teamColor, letterSpacing: "0.1em" }}>
                    {teamLabel}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name || `Player ${p.steamid.slice(-6)}`}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                <span><b style={{ color: "#FF6B35" }}>{p.kills}</b> K</span>
                <span><b style={{ color: "rgba(255,255,255,0.7)" }}>{p.deaths}</b> D</span>
                <span><b style={{ color: "rgba(255,255,255,0.7)" }}>{hsRate}%</b> HS</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA bar — sticky-feel quando player picked */}
      {picked && (
        <div style={{
          marginTop: 24,
          padding: "20px 24px",
          background: "#1A1A2E",
          border: "1px solid #2D2D44",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Player escolhido
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {picked.name || `Player ${picked.steamid.slice(-6)}`}
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: 10 }}>
                {picked.kills} kills · {picked.headshots} HS
              </span>
            </div>
          </div>
          <MapearPlaysButton sha={sha} player={picked} />
        </div>
      )}

      <p style={{ marginTop: 32, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
        Render usa POV in-eye do player escolhido (`spec_player` no HLAE).
        Pipeline padrão FragReel — mood, X-ray, orientação, flash, bomb timer
        configuráveis na próxima etapa.
      </p>
    </>
  );
}

function MapearPlaysButton({ sha, player }: { sha: string; player: DemoRosterPlayer }) {
  // Sprint #7 Phase 7.2 — MVP atual: salva intent + alert. Phase 7.3+ vai
  // wire o flow completo: Ad 30s → POST /demos/<sha>/score com
  // target_steamid → highlights → user picks ranks → render via /render
  // com user_steamid64 + user_player_name overrides.
  const [pending, setPending] = useState(false);
  return (
    <button
      onClick={() => {
        setPending(true);
        sessionStorage.setItem("fragreel:demo:intent", JSON.stringify({
          sha,
          target_steamid: player.steamid,
          target_name: player.name,
          picked_at: Date.now(),
        }));
        alert(
          `Player escolhido: ${player.name || player.steamid}\n\n` +
          `Phase 7.3 (fluxo Ad → score → highlights → render) em desenvolvimento.\n\n` +
          `Próxima sprint conecta:\n` +
          `1. Ad 30s enquanto demo é parseada + scoreada\n` +
          `2. Highlights aparecem pra você escolher\n` +
          `3. "Gerar FragReel" → render com perspectiva do ${player.name}\n` +
          `4. Ad final → download MP4\n\n` +
          `Por enquanto, intent salvo em sessionStorage pra debug.`
        );
        setPending(false);
      }}
      disabled={pending}
      className="btn-primary"
      style={{ padding: "12px 24px", fontSize: 14, opacity: pending ? 0.6 : 1 }}
    >
      {pending ? "..." : "🎯 Mapear plays de impacto"}
    </button>
  );
}
