"use client";

/**
 * InstallingClientBanner — Sprint Install Indicator (06/05).
 *
 * Mathieu spec: "Tem como ter um identificador no fragreel, no site que,
 * quando o exe foi baixado e clicado, mostra que está sendo instalado o
 * client?".
 *
 * Renderiza banner fixo top quando user clicou em "Baixar" recentemente
 * E client local ainda não respondeu. Some sozinho quando o client vem
 * online (hook clearDownloadClick) ou quando expira a janela de 5min.
 *
 * Uso:
 *   const status = useClientVersionStatus();
 *   {status.status === "installing" && <InstallingClientBanner secondsElapsed={status.installingForSec ?? 0} />}
 */
import Spinner from "./Spinner";

type Props = {
  secondsElapsed: number;
};

export default function InstallingClientBanner({ secondsElapsed }: Props) {
  // Stages aproximados pra dar feedback ao user:
  //   0-30s    → "Baixando o instalador..."
  //   30-60s   → "Abra o FragReel.exe baixado pra continuar"
  //   60-180s  → "Instalando dependências..."
  //   180-300s → "Quase lá... primeira execução pode demorar"
  let stageLabel = "Baixando o instalador…";
  let stageHint = "FragReel.exe (~120 MB)";
  if (secondsElapsed > 30) {
    stageLabel = "Abra o FragReel.exe baixado";
    stageHint = "Procure na pasta Downloads e dê duplo clique";
  }
  if (secondsElapsed > 60) {
    stageLabel = "Instalando dependências…";
    stageHint = "HLAE, Node, ffmpeg, editor (~210 MB no first-run)";
  }
  if (secondsElapsed > 180) {
    stageLabel = "Quase lá…";
    stageHint = "Primeira execução demora um pouco mais";
  }

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
        border: "1px solid rgba(255, 107, 53, 0.35)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(255,107,53,0.18)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: "min(92vw, 560px)",
      }}
    >
      <Spinner size={28} color="#FF6B35" />
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
          {stageLabel}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.4,
          }}
        >
          {stageHint} · há {secondsElapsed}s
        </div>
      </div>
    </div>
  );
}
