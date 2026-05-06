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
import Spinner from "@/components/Spinner";
import AdSlot from "@/components/AdSlot";

const TEAM_LABEL: Record<number, string> = { 2: "T", 3: "CT" };
const TEAM_COLOR: Record<number, string> = { 2: "#fbbf24", 3: "#60a5fa" };

export default function DemoRosterClient({ sha }: { sha: string }) {
  const [data, setData] = useState<DemoRosterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 06/05 (Mathieu): "era melhor quando estava em cada card". Removido
  // step picked → confirm. Click direto no card OU no CTA inline dispara
  // o flow de render. UX 1-step em vez de 2-step.
  const [pendingPlayer, setPendingPlayer] = useState<string | null>(null);

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
    // 06/05 — Mathieu spec: loaders animados + ads em páginas de loading.
    // Antes era 1-line texto estático "Parseando demo...". Agora Spinner
    // + label + sublabel + shimmer bar + AdSlot abaixo (não interfere com
    // a experiência de geração que já tem video ad).
    return (
      <div>
        <Spinner
          block
          label="Parseando a demo…"
          sublabel="Lendo todos os ticks pra detectar os 10 players + estatísticas. Pode levar 5-15s em demos grandes (BLAST/HLTV)."
          showBar
        />
        <div style={{ marginTop: 24 }}>
          <AdSlot id="demo-roster-loader-ad" size="rectangle" label="Anúncio" />
        </div>
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

      {/* Roster grid — 06/05 redesign + per-card CTA (Mathieu spec):
          "Escolha o player ficou bem melhor, mas precisa de um CTA mapear
          kills de impacto" → "era melhor quando estava em cada card".
          Modelo: cada card é o CTA. Click anywhere → vai direto pro
          render flow do player escolhido (1-step UX, sem confirmation
          intermediária).
          Cards com avatar gradient (initial + hash-based color), rank
          medal #1/#2/#3 gold/silver/bronze, stats em pills, footer com
          CTA inline "Mapear plays de impacto →". */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {data.roster.map((p, idx) => {
          const isPending = pendingPlayer === p.steamid;
          const teamLabel = p.team !== null ? TEAM_LABEL[p.team] : null;
          const teamColor = p.team !== null ? TEAM_COLOR[p.team] : "#666";
          const hsRate = p.kills > 0 ? Math.round((p.headshots / p.kills) * 100) : 0;
          const displayName = p.name || `Player ${p.steamid.slice(-6)}`;
          const initial = displayName.trim().charAt(0).toUpperCase() || "?";

          // Avatar color: deterministic hash do steamid (até backlog de
          // Steam avatar fetch) — cores vibrantes pra dar identidade visual.
          const palette = ["#FF6B35", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6"];
          const hash = Array.from(p.steamid).reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const avatarColor = palette[hash % palette.length];

          // Rank medal: top 3 ganham cor especial (gold/silver/bronze) tipo leaderboard
          const rankColors: Record<number, string> = { 0: "#FFD700", 1: "#C0C0C0", 2: "#CD7F32" };
          const rankColor = rankColors[idx] || "rgba(255,255,255,0.3)";

          // 06/05 — handler único do flow. Click direto no card OU no CTA
          // dispara o redirect pro /demo/[sha]/render?steamid=...&name=...
          // Mesma lógica do antigo MapearPlaysButton (sessionStorage +
          // URLSearchParams), agora inline pra UX 1-step.
          const handlePick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (pendingPlayer) return; // já tem flow em progresso
            setPendingPlayer(p.steamid);
            sessionStorage.setItem("fragreel:demo:intent", JSON.stringify({
              sha,
              target_steamid: p.steamid,
              target_name: p.name,
              picked_at: Date.now(),
            }));
            const params = new URLSearchParams({
              steamid: p.steamid,
              name: p.name ?? `Player ${p.steamid.slice(-6)}`,
            });
            window.location.href = `/demo/${sha}/render?${params.toString()}`;
          };

          return (
            <button
              key={p.steamid}
              onClick={handlePick}
              disabled={isPending || !!pendingPlayer}
              aria-label={`Mapear plays de impacto de ${displayName} — ${p.kills} kills, ${p.deaths} deaths`}
              style={{
                textAlign: "left",
                padding: "16px",
                background: isPending
                  ? "linear-gradient(135deg, rgba(255,107,53,0.18) 0%, rgba(255,107,53,0.06) 100%)"
                  : "#1A1A2E",
                border: isPending ? "2px solid #FF6B35" : "1px solid #2D2D44",
                borderRadius: 12,
                cursor: pendingPlayer ? "wait" : "pointer",
                opacity: pendingPlayer && !isPending ? 0.4 : 1,
                color: "inherit",
                fontFamily: "inherit",
                transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease, opacity 200ms ease",
                boxShadow: isPending
                  ? "0 8px 24px rgba(255,107,53,0.25), 0 0 0 1px rgba(255,107,53,0.4)"
                  : "0 2px 8px rgba(0,0,0,0.2)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
              onMouseEnter={(e) => {
                if (!pendingPlayer) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "rgba(255,107,53,0.4)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(255,107,53,0.18)";
                }
              }}
              onMouseLeave={(e) => {
                if (!pendingPlayer) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#2D2D44";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
                }
              }}
            >
              {/* Top row — rank medal + team badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  background: idx < 3 ? `${rankColor}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${idx < 3 ? rankColor + "55" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  color: rankColor,
                  letterSpacing: "0.05em",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  #{idx + 1}
                </div>
                {teamLabel && (
                  <div style={{
                    padding: "3px 8px",
                    background: `${teamColor}18`,
                    border: `1px solid ${teamColor}55`,
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    color: teamColor,
                    letterSpacing: "0.12em",
                  }}>
                    {teamLabel}
                  </div>
                )}
              </div>

              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, minWidth: 0 }}>
                <div
                  aria-hidden
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${avatarColor}cc 0%, ${avatarColor}66 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 900,
                    color: "white",
                    flexShrink: 0,
                    border: `1px solid ${avatarColor}55`,
                    boxShadow: `0 4px 12px ${avatarColor}33`,
                    fontFamily: "var(--font-display, inherit)",
                  }}
                >
                  {initial}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E8E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono, monospace)", marginTop: 2 }}>
                    ID …{p.steamid.slice(-6)}
                  </div>
                </div>
              </div>

              {/* Stats pills */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <div style={{ flex: 1, padding: "6px 8px", background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#FF6B35", fontFamily: "var(--font-mono, monospace)" }}>{p.kills}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,107,53,0.7)", letterSpacing: "0.1em" }}>KILLS</div>
                </div>
                <div style={{ flex: 1, padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-mono, monospace)" }}>{p.deaths}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>DEATHS</div>
                </div>
                <div style={{ flex: 1, padding: "6px 8px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24", fontFamily: "var(--font-mono, monospace)" }}>{hsRate}%</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(251,191,36,0.7)", letterSpacing: "0.1em" }}>HS</div>
                </div>
              </div>

              {/* Inline CTA — sempre visível em cada card (06/05 Mathieu spec) */}
              <div style={{
                marginTop: "auto",
                padding: "10px 12px",
                background: isPending ? "#FF6B35" : "rgba(255,107,53,0.10)",
                border: `1px solid ${isPending ? "#FF6B35" : "rgba(255,107,53,0.35)"}`,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: isPending ? "white" : "#FF6B35",
                letterSpacing: "0.01em",
                transition: "background 200ms ease, color 200ms ease",
              }}>
                {isPending ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 50 50" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" style={{ animation: "spin 0.9s linear infinite" }} aria-hidden>
                      <circle cx="25" cy="25" r="20" strokeOpacity="0.3"/>
                      <circle cx="25" cy="25" r="20" strokeDasharray="32 200"/>
                    </svg>
                    Carregando…
                  </>
                ) : (
                  <>
                    <span>🎯 Mapear plays de impacto</span>
                    <span style={{ marginLeft: 2 }}>→</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 06/05 — bottom CTA bar removido. CTA agora vive INSIDE cada card
          (Mathieu spec: "era melhor quando estava em cada card"). UX 1-step:
          click no card = ir direto pro render flow. */}

      <p style={{ marginTop: 32, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
        Render usa POV in-eye do player escolhido (`spec_player` no HLAE).
        Pipeline padrão FragReel — mood, X-ray, orientação, flash, bomb timer
        configuráveis na próxima etapa.
      </p>
    </>
  );
}

// 06/05 — MapearPlaysButton removido. Lógica inline no card click handler
// (`handlePick` em DemoRosterClient) per Mathieu spec "era melhor quando
// estava em cada card". 1-step UX em vez de 2-step.
