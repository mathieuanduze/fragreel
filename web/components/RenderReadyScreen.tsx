"use client";

/**
 * RenderReadyScreen — tela "Seu FragReel está pronto!" pós render.
 *
 * Sprint v5.7.17 (Mathieu 09/05/2026): "vamos fazer uma tela extra
 * quando o vídeo fica pronto ao invés de só o botão baixar fragreel?
 * O popup de renderização muda pra um com o video embedado, 'Seu
 * Fragreel está pronto' onde ele pode baixar ou compartilhar via
 * whatsapp, instagram ou tik tok".
 *
 * Substitui o estado "done" do AdModal por uma celebração + ações.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  ✅ Seu FragReel está pronto!        │
 *   │                                      │
 *   │  ┌──────────────────────────────┐   │
 *   │  │   <video preview embedded>    │   │
 *   │  │   autoPlay muted loop         │   │
 *   │  └──────────────────────────────┘   │
 *   │                                      │
 *   │  [▶ Abrir vídeo]  [📁 Mostrar]     │
 *   │                                      │
 *   │  ── Compartilhe ──                   │
 *   │  [WhatsApp]  [Instagram]  [TikTok]  │
 *   └──────────────────────────────────────┘
 *
 * Video preview vem de http://127.0.0.1:5775/render/preview (endpoint
 * v0.6.63+ no client). Browser <video> tag pega range requests pro
 * seek funcionar.
 */

import { useState } from "react";
import {
  CheckCircle2,
  Play,
  FolderOpen,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";

const LOCAL_BASE = "http://127.0.0.1:5775";

interface Props {
  /** Path absoluto do MP4 final no PC do user (display only). */
  mp4Path: string;
  /** Filesize em bytes (display only). */
  sizeBytes?: number;
  /** Map name pretty pra mensagem default share (ex: "Inferno"). */
  mapName?: string;
  /** Player name pra mensagem default share. */
  playerName?: string;
  /** Open vídeo callback (já implementado em AdModal — chama /render/open). */
  onOpenVideo: () => void;
  /** Open pasta callback (também já em AdModal — fallback do open). */
  onOpenFolder?: () => void;
  /** Close callback. */
  onClose: () => void;
}

export default function RenderReadyScreen({
  mp4Path,
  sizeBytes,
  mapName,
  playerName,
  onOpenVideo,
  onOpenFolder,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const filename = mp4Path.split(/[\\/]/).pop() || "fragreel.mp4";
  const sizeMB = sizeBytes ? (sizeBytes / 1024 / 1024).toFixed(1) : null;

  // Default share message
  const shareText = `Meu FragReel${
    mapName ? ` no ${mapName.replace(/^de_/, "")}` : ""
  } 🎯${playerName ? ` (${playerName})` : ""} — feito em fragreel.gg`;

  function handleCopyPath() {
    navigator.clipboard.writeText(mp4Path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleWhatsApp() {
    // wa.me intent abre WhatsApp web/app com texto pré-preenchido.
    // User precisa anexar o vídeo manualmente (browsers não conseguem
    // attachar local file via URL scheme). Mostra instrução clara.
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShareHint(
      "WhatsApp abriu — agora anexa o vídeo (clipe icon) e seleciona o arquivo da sua pasta",
    );
  }

  function handleInstagram() {
    // Instagram não tem URL scheme público pra share. Mostra instrução +
    // copy path pra user fazer manual.
    handleCopyPath();
    setShareHint(
      "Caminho copiado! Abre Instagram → Reels/Story → '+' → seleciona o vídeo",
    );
  }

  function handleTikTok() {
    handleCopyPath();
    setShareHint(
      "Caminho copiado! Abre TikTok → '+' → 'Upload' → seleciona o vídeo",
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.94)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#0f0f1a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(91,227,143,0.15)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 14px",
            background:
              "linear-gradient(135deg, rgba(91,227,143,0.12) 0%, transparent 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(91,227,143,0.18)",
              border: "1px solid rgba(91,227,143,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={20} style={{ color: "#5be38f" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "white",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Seu FragReel está pronto!
            </h2>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                marginTop: 2,
                fontFamily: "monospace",
              }}
              title={mp4Path}
            >
              {filename}
              {sizeMB ? ` · ${sizeMB} MB` : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Video preview */}
        <div
          style={{
            padding: "16px 24px",
            background: "#000",
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={`${LOCAL_BASE}/render/preview`}
            controls
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: "100%",
              maxHeight: 420,
              borderRadius: 8,
              background: "#000",
              display: "block",
            }}
          />
        </div>

        {/* Primary actions */}
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            gap: 8,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={onOpenVideo}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              color: "white",
              background: "#FF6B35",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: "0 4px 14px rgba(255,107,53,0.25)",
            }}
          >
            <Play size={14} fill="currentColor" />
            Abrir vídeo
          </button>
          {onOpenFolder && (
            <button
              onClick={onOpenFolder}
              style={{
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.75)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FolderOpen size={14} />
              Mostrar pasta
            </button>
          )}
          <button
            onClick={handleCopyPath}
            title="Copiar caminho do arquivo"
            style={{
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.65)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {copied ? (
              <>
                <CheckCircle2 size={14} style={{ color: "#5be38f" }} />
                Copiado
              </>
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>

        {/* Share section */}
        <div style={{ padding: "16px 24px 20px" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Share2 size={11} />
            Compartilhe nas redes
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <ShareButton
              label="WhatsApp"
              color="#25D366"
              bg="rgba(37,211,102,0.10)"
              border="rgba(37,211,102,0.30)"
              onClick={handleWhatsApp}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.595 5.45l.36.572-1.014 3.7 3.748-.99zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                </svg>
              }
            />
            <ShareButton
              label="Instagram"
              color="#E4405F"
              bg="rgba(228,64,95,0.10)"
              border="rgba(228,64,95,0.30)"
              onClick={handleInstagram}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              }
            />
            <ShareButton
              label="TikTok"
              color="#fff"
              bg="rgba(255,255,255,0.06)"
              border="rgba(255,255,255,0.20)"
              onClick={handleTikTok}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.84-.1z" />
                </svg>
              }
            />
          </div>

          {shareHint && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "rgba(255,107,53,0.08)",
                border: "1px solid rgba(255,107,53,0.20)",
                borderRadius: 8,
                fontSize: 12,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.45,
              }}
            >
              💡 {shareHint}
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1.5,
            }}
          >
            Browsers não conseguem anexar arquivos locais direto — você seleciona
            o vídeo manualmente no app de destino.
            <a
              href={mp4Path}
              download={filename}
              style={{
                marginLeft: 6,
                color: "#FF6B35",
                textDecoration: "none",
                borderBottom: "1px dotted #FF6B35",
              }}
            >
              ou baixe direto <ExternalLink size={10} style={{ display: "inline" }} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareButton({
  label,
  icon,
  color,
  bg,
  border,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 8px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        color,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        transition: "transform 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {icon}
      {label}
    </button>
  );
}
