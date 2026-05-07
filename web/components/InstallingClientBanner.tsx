"use client";

/**
 * InstallingClientBanner — Sprint Install Indicator B (06/05) + simplificação 07/05.
 *
 * Mathieu spec round 4 (07/05): as progress bars (real + timing-based) NÃO
 * acompanhavam velocidade real de instalação. Decisão: remover progress bars
 * e deixar apenas spinner + texto curto. "A informação 'client instalando'
 * com o carregamento ativo já está ótimo." Educação sobre SmartScreen
 * migrou pro SmartScreenWarningModal (1x no click do download).
 *
 * Modo REAL (installStatus disponível):
 *   - Spinner + phase_label exato vindo do client
 *   - Sem progress bars de componente (eram fake-ish — bytes baixados não
 *     refletem instalação efetiva)
 *
 * Modo TIMING (fallback — installStatus null):
 *   - Stages textuais úteis (downloading → waiting → installing) com spinner
 *   - Sem barras fake — só ícone + texto + hint
 */
import Spinner from "./Spinner";
import type { InstallStatus } from "@/lib/local";

type Props = {
  secondsElapsed: number;
  installStatus?: InstallStatus | null;
};

export default function InstallingClientBanner({ secondsElapsed, installStatus }: Props) {
  // Modo REAL: client respondeu, mostra phase_label sem progress bars.
  if (installStatus && !installStatus.ready) {
    return <InstallingBannerReal status={installStatus} />;
  }

  // Modo TIMING fallback (client ainda não respondeu)
  // 4 stages preservadas — texto comunica estado, mas SEM barra fake.
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
      hint: "First-run baixa HLAE, Node, ffmpeg e editor (~210 MB)",
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
 * Spec round 4 (07/05): SEM progress bars (não acompanhavam velocidade
 * real). Mantém apenas spinner + phase_label + elapsed_sec — comunica
 * "algo está acontecendo" sem mentir sobre o quanto falta.
 */
function InstallingBannerReal({ status }: { status: InstallStatus }) {
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
        background: "rgba(13, 13, 26, 0.94)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 107, 53, 0.4)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 28px rgba(255,107,53,0.22)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: "min(92vw, 580px)",
      }}
    >
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
  );
}
