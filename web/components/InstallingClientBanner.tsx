"use client";

/**
 * InstallingClientBanner — Sprint Install Indicator (06/05).
 *
 * Mathieu spec round 2: "seria quando o usuário clica no .exe, não no
 * download, pq pode fazer o usuário pensar que era só clicar no client".
 *
 * Não dá pra detectar click do .exe direto da web (sem beacon dedicado),
 * MAS dá pra mudar mensageria pra ficar CLARO que user tem ação a tomar.
 * Banner não diz "Instalando..." nos primeiros 60s — diz "Abra o
 * FragReel.exe" instrucional. Só vira "Instalando..." quando passou tempo
 * suficiente sugerindo que user abriu .exe e setup está rolando OU
 * quando client efetivamente vem online (clearDownloadClick dismiss).
 *
 * Stages:
 *   0-15s    → "Baixando o FragReel.exe…" (download em curso)
 *   15-60s   → "Abra o FragReel.exe que foi baixado" (instructive)
 *              Cor mudada pra azul (info) em vez de laranja (active)
 *   60-180s  → "Instalando dependências…" (active)
 *              Volta laranja, assume user abriu .exe
 *   180-300s → "Quase lá…" (active)
 */
import Spinner from "./Spinner";

type Props = {
  secondsElapsed: number;
};

export default function InstallingClientBanner({ secondsElapsed }: Props) {
  // Stage detection
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
