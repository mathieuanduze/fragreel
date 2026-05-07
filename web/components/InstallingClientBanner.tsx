"use client";

/**
 * InstallingClientBanner — Sprint Install Indicator B (06/05).
 *
 * Mathieu spec round 3: install_progress_server.py do client agora reporta
 * progresso REAL via /install-status. Banner usa esse payload quando
 * disponível (priority sobre timing-based).
 *
 * Modo REAL (installStatus disponível):
 *   - Mostra phase_label exato vindo do client ("Baixando HLAE + ffmpeg…")
 *   - Mostra progresso de cada componente (HLAE, Node, Editor) com %
 *   - Atualiza em tempo real (1.5s poll)
 *
 * Modo TIMING (fallback — installStatus null):
 *   - Stages timing-based (download/waiting/installing/finishing) como antes
 *   - Aparece quando download foi clicado mas .exe ainda nem abriu
 */
import Spinner from "./Spinner";
import type { InstallStatus } from "@/lib/local";

type Props = {
  secondsElapsed: number;
  installStatus?: InstallStatus | null;
};

export default function InstallingClientBanner({ secondsElapsed, installStatus }: Props) {
  // Modo REAL: client está respondendo, mostra progresso vindo do install_state.py
  if (installStatus && !installStatus.ready) {
    return <InstallingBannerReal status={installStatus} />;
  }

  // Modo TIMING fallback (client ainda não respondeu)
  const stage =
    secondsElapsed < 15 ? "downloading"
    : secondsElapsed < 60 ? "waiting"
    : secondsElapsed < 180 ? "installing"
    : "finishing";

  const config = {
    downloading: {
      label: "Baixando o FragReel.exe…",
      hint: "~120 MB · espere o download terminar antes de abrir",
      color: "#FF6B35",
      borderColor: "rgba(255, 107, 53, 0.35)",
      glow: "rgba(255,107,53,0.18)",
      icon: "active" as const,
    },
    waiting: {
      label: "Agora abra o FragReel.exe pra instalar",
      hint: "Procure na pasta Downloads e dê duplo clique no arquivo",
      color: "#60a5fa",
      borderColor: "rgba(96, 165, 250, 0.4)",
      glow: "rgba(96,165,250,0.2)",
      icon: "info" as const,
    },
    installing: {
      label: "Instalando o client…",
      hint: "HLAE, Node, ffmpeg, editor (~210 MB no first-run)",
      color: "#FF6B35",
      borderColor: "rgba(255, 107, 53, 0.35)",
      glow: "rgba(255,107,53,0.18)",
      icon: "active" as const,
    },
    finishing: {
      label: "Quase lá…",
      hint: "First-run demora um pouco mais. Aguenta firme.",
      color: "#FF6B35",
      borderColor: "rgba(255, 107, 53, 0.35)",
      glow: "rgba(255,107,53,0.18)",
      icon: "active" as const,
    },
  }[stage];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        padding: "14px 22px",
        background: "rgba(13, 13, 26, 0.92)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${config.borderColor}`,
        borderRadius: 12,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${config.glow}`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: "min(92vw, 580px)",
      }}
    >
      {config.icon === "active" ? (
        <Spinner size={28} color={config.color} />
      ) : (
        // Info icon (download arrow) — comunica "ação do user requerida"
        // em vez de "ação em curso" do spinner.
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: `${config.color}22`,
            border: `2px solid ${config.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            animation: "pulse-bg 2s ease-in-out infinite",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#E8E8F0",
            marginBottom: 2,
            letterSpacing: "0.01em",
          }}
        >
          {config.label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.4,
          }}
        >
          {config.hint}
        </div>
      </div>
    </div>
  );
}

/**
 * Versão REAL do banner — usa payload do /install-status do client.
 * Mostra phase_label exato + progress bars dos components em download.
 */
function InstallingBannerReal({ status }: { status: InstallStatus }) {
  const components = Object.values(status.components || {});
  // Sort por % desc pra mostrar o que está mais perto de terminar primeiro
  components.sort((a, b) => b.pct - a.pct);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        padding: "16px 22px",
        background: "rgba(13, 13, 26, 0.94)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 107, 53, 0.4)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 28px rgba(255,107,53,0.22)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: "min(92vw, 600px)",
        minWidth: 360,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Spinner size={28} color="#FF6B35" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "#E8E8F0",
            letterSpacing: "0.01em", marginBottom: 2,
          }}>
            Instalando o FragReel client…
          </div>
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.6)",
            lineHeight: 1.4,
          }}>
            {status.phase_label} · {Math.round(status.elapsed_sec)}s
          </div>
        </div>
      </div>

      {/* Progress bars dos componentes em download */}
      {components.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {components.map((c) => (
            <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                  {c.label}
                </span>
                <span style={{
                  color: c.pct >= 100 ? "#5be38f" : "rgba(255,255,255,0.5)",
                  fontWeight: 700, fontVariantNumeric: "tabular-nums",
                }}>
                  {c.total > 0
                    ? `${(c.downloaded / 1024 / 1024).toFixed(1)} / ${(c.total / 1024 / 1024).toFixed(1)} MB · ${c.pct}%`
                    : "…"}
                </span>
              </div>
              <div style={{
                height: 4,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${c.pct}%`,
                  height: "100%",
                  background: c.pct >= 100
                    ? "linear-gradient(90deg, #5be38f 0%, #34d399 100%)"
                    : "linear-gradient(90deg, #FF6B35 0%, #FF8E53 100%)",
                  transition: "width 300ms ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
