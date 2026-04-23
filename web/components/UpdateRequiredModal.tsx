"use client";

import { CLIENT_VERSION } from "@/lib/version";

type Props = {
  /** Versão que o usuário tem rodando agora (ou null se desconhecida). */
  localVersion: string | null;
  onClose: () => void;
};

/**
 * Modal bloqueante que aparece quando o usuário tenta gerar um FragReel
 * com client antigo. Sem auto-update no `.exe`, isso é a única defesa
 * contra users gerando reels com bugs já corrigidos (ex: ProRes .mov
 * ilegível pré-v0.2.9, câmera estática pré-v0.2.6, etc).
 *
 * Não é dismissível por click fora — ou atualiza ou fecha o X.
 */
export default function UpdateRequiredModal({ localVersion, onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 16,
          maxWidth: 480,
          width: "100%",
          padding: 32,
          border: "1px solid rgba(255,193,7,0.45)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            fontSize: 24,
            cursor: "pointer",
            padding: 4,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>⚠️</div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "white", margin: 0, textAlign: "center" }}>
          Atualize o FragReel
        </h2>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 12, marginBottom: 24, lineHeight: 1.5 }}>
          Você está com uma versão antiga do client.
          <br />
          Versões antigas geram arquivos que podem não tocar em players comuns
          (ex: Windows Media Player) e perdem correções recentes da câmera + edição.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5 }}>Você tem</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
              {localVersion ?? "versão desconhecida"}
            </div>
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }}>→</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "rgba(255,193,7,0.85)", textTransform: "uppercase", letterSpacing: 0.5 }}>Atualizar para</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFC107", marginTop: 2 }}>{CLIENT_VERSION}</div>
          </div>
        </div>

        <a
          href="/download"
          download="FragReel.exe"
          style={{
            display: "block",
            background: "linear-gradient(135deg, #FF6B35, #FF8E53)",
            color: "white",
            padding: "14px 24px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            textAlign: "center",
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(255,107,53,0.35)",
          }}
        >
          ⬇ Baixar FragReel {CLIENT_VERSION}
        </a>

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 16, marginBottom: 0, lineHeight: 1.5 }}>
          Depois de baixar, feche o client antigo na bandeja do sistema
          e abra o novo `.exe`. A página detecta automaticamente.
        </p>
      </div>
    </div>
  );
}
