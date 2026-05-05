"use client";

/**
 * Sprint #5 Phase B — Roster picker pra "render qualquer player".
 *
 * Mostra os 10 players da demo (top fragger primeiro) com kills/HS/team.
 * User clica num player → MVP placeholder (Phase C wire pending).
 *
 * MVP shipped agora: roster picker visual + botão "Renderizar reel" que
 * salva intent em sessionStorage + alert. Próximo sprint completa Phase C
 * (custom score+render endpoint).
 */
import { useEffect, useState } from "react";
import {
  getDemoRoster,
  type DemoRosterPlayer,
  type DemoRosterResponse,
} from "@/lib/local";

const TEAM_LABEL: Record<number, string> = {
  2: "T",
  3: "CT",
};

const TEAM_COLOR: Record<number, string> = {
  2: "#fbbf24",  // T = amarelo CS
  3: "#60a5fa",  // CT = azul CS
};

export default function ProRosterClient({ sha }: { sha: string }) {
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
        Parseando demo... (5-15s pra demos grandes)
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

      {/* CTA bar (sticky bottom feel) */}
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
          <ProRenderButton sha={sha} player={picked} />
        </div>
      )}

      <p style={{ marginTop: 32, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
        Render usa POV in-eye do player escolhido (`spec_player` no HLAE).
        Mesmo pipeline do FragReel padrão — mood, X-ray e orientação configuráveis.
      </p>
    </>
  );
}

function ProRenderButton({ sha, player }: { sha: string; player: DemoRosterPlayer }) {
  // Sprint #5 status: Phase A (roster endpoint) + Phase B (UI roster picker)
  // shipped. Phase C (custom score+render endpoint) ainda em desenvolvimento.
  //
  // Phase C scope: novo endpoint `/demos/<sha>/render-pro` que internamente:
  //   1. parseia .dem com target_steamid override (já suportado)
  //   2. POST eventos pra /api/score com player_steamid=target_steamid
  //   3. recebe highlights scored
  //   4. monta render plan + spawna render via render_coordinator
  //   5. retorna render session pra web mostrar progress
  // Plus UI: web mostra preview cards dos highlights antes de render +
  // mood/orientation/xray pickers + AdModal pra render flow.
  // Esforço Phase C: ~3-4h.
  const [pending, setPending] = useState(false);
  return (
    <button
      onClick={() => {
        setPending(true);
        // MVP placeholder honest: salva intent + avisa user.
        sessionStorage.setItem("fragreel:pro:intent", JSON.stringify({
          sha,
          target_steamid: player.steamid,
          target_name: player.name,
          picked_at: Date.now(),
        }));
        alert(
          `Selecionado: ${player.name || player.steamid}\n\n` +
          `Phase C (render flow) em desenvolvimento.\n` +
          `Roster picker já registra o player escolhido.\n\n` +
          `Próxima sprint conecta: parse → score com target_steamid → ` +
          `render via local client.\n\n` +
          `Por hora, intent salvo em sessionStorage pra debug.`
        );
        setPending(false);
      }}
      disabled={pending}
      className="btn-primary"
      style={{ padding: "12px 24px", fontSize: 14, opacity: pending ? 0.6 : 1 }}
    >
      {pending ? "..." : "Renderizar reel ▶"}
    </button>
  );
}
