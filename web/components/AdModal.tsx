"use client";

import { useEffect, useState, useCallback } from "react";

const AD_DURATION = 30;

const ADS = [
  {
    icon: "🎮",
    brand: "SteelSeries Arctis Nova Pro",
    tagline: "O headset dos jogadores que chegam no topo. Microfone retrátil, som surround 360°.",
    url: "steelseries.com/pt-br",
    gradient: "linear-gradient(135deg, #0e1a2b, #1b3a5e)",
    glow: "rgba(70,140,220,0.18)",
  },
  {
    icon: "🖱️",
    brand: "Razer DeathAdder V3 HyperSpeed",
    tagline: "Precisão absoluta para cada frag. Sensor Focus Pro 30K DPI.",
    url: "razer.com/pt-br",
    gradient: "linear-gradient(135deg, #071407, #0f2e0f)",
    glow: "rgba(0,200,60,0.14)",
  },
  {
    icon: "🖥️",
    brand: "KaBuM! Gaming",
    tagline: "Hardware top de linha com os melhores preços. Parcelamento em até 12x sem juros.",
    url: "kabum.com.br/gaming",
    gradient: "linear-gradient(135deg, #1a0900, #2e1400)",
    glow: "rgba(255,110,0,0.14)",
  },
];

type AdModalProps = {
  onClose: () => void;
  formatLabel: string;
  renderDuration: number;
};

function fmtTime(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, "0")}s`;
  return `${sec}s`;
}

export default function AdModal({ onClose, formatLabel, renderDuration }: AdModalProps) {
  const [adElapsed, setAdElapsed]       = useState(0);
  const [adIndex, setAdIndex]           = useState(0);
  const [renderElapsed, setRenderElapsed] = useState(0);
  const [closing, setClosing]           = useState(false);

  const renderDone    = renderElapsed >= renderDuration;
  const adDone        = adElapsed >= AD_DURATION;
  const canDownload   = renderDone && adDone;
  const adRemaining   = Math.max(0, AD_DURATION - adElapsed);
  const adProgress    = Math.min(1, adElapsed / AD_DURATION);
  const renderProgress = Math.min(1, renderElapsed / renderDuration);
  const renderRemaining = Math.max(0, renderDuration - renderElapsed);
  const adCount       = Math.floor(renderElapsed / AD_DURATION) + 1;

  // Ad timer — counts up to AD_DURATION (mínimo obrigatório)
  // Se o render ainda estiver rodando quando o ad terminar, reinicia com outro anúncio
  useEffect(() => {
    const id = setInterval(() => {
      setAdElapsed((e) => {
        const next = e + 1;
        if (next >= AD_DURATION) {
          // Se render ainda está rodando, troca de anúncio e reinicia o contador
          if (!renderDone) {
            setAdIndex((i) => (i + 1) % ADS.length);
            return 0;
          }
          // Render já terminou: trava o ad em AD_DURATION (libera o botão)
          return AD_DURATION;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [renderDone]);

  // Render timer — counts up to renderDuration
  useEffect(() => {
    if (renderDone) return;
    const id = setInterval(() => {
      setRenderElapsed((e) => Math.min(e + 1, renderDuration));
    }, 1000);
    return () => clearInterval(id);
  }, [renderDone, renderDuration]);

  const handleDownload = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 600);
  }, [onClose]);

  const ad = ADS[adIndex];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.94)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: closing ? "adFadeOut 0.3s ease forwards" : "adFadeIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes adFadeIn  { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes adFadeOut { from { opacity:1; } to { opacity:0; } }
        @keyframes pulse     { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes adSlide   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
            PUBLICIDADE · Anúncio {adCount} · enquanto seu vídeo renderiza
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
            {adRemaining}s restantes
          </div>
        </div>

        {/* Ad video area */}
        <div
          key={adIndex}
          style={{
            width: "100%", aspectRatio: "16/9",
            background: ad.gradient,
            borderRadius: 12, overflow: "hidden",
            position: "relative", border: "1px solid #2D2D44",
            animation: "adSlide 0.3s ease",
            boxShadow: `0 0 80px ${ad.glow}`,
          }}
        >
          {/* Ad content */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
            <div
              style={{
                width: 80, height: 80, borderRadius: 18,
                background: "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 38,
              }}
            >
              {ad.icon}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginBottom: 10, letterSpacing: "-0.02em" }}>
                {ad.brand}
              </div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", maxWidth: 380, lineHeight: 1.6 }}>
                {ad.tagline}
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: "#4a9eff", fontWeight: 600, letterSpacing: "0.04em" }}>
                {ad.url}
              </div>
            </div>
          </div>

          {/* Recording dot */}
          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4444", display: "inline-block", animation: "pulse 1s infinite" }} />
            0:{String(adRemaining).padStart(2, "0")}
          </div>

          {/* Sponsored badge */}
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
            PATROCINADO
          </div>

          {/* Ad progress bar */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ height: "100%", width: `${adProgress * 100}%`, background: "rgba(255,255,255,0.3)", transition: "width 1s linear" }} />
          </div>
        </div>

        {/* Render status panel */}
        <div
          style={{
            marginTop: 12, padding: "18px 22px",
            background: "#13131f",
            border: `1px solid ${canDownload ? "rgba(76,175,130,0.4)" : "#2D2D44"}`,
            borderRadius: 12,
            transition: "border-color 0.4s",
          }}
        >
          {/* Render progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: renderDone ? "#4CAF82" : "rgba(255,255,255,0.7)" }}>
                {renderDone ? `✓ ${formatLabel} pronto!` : `⚙️ Renderizando ${formatLabel}...`}
              </div>
              <div style={{ fontSize: 12, color: renderDone ? "#4CAF82" : "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                {renderDone ? "100%" : `${Math.round(renderProgress * 100)}% · ${fmtTime(renderRemaining)} restantes`}
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${renderProgress * 100}%`,
                  background: renderDone
                    ? "linear-gradient(90deg, #4CAF82, #2ecc71)"
                    : "linear-gradient(90deg, #FF6B35, #ff9966)",
                  borderRadius: 999,
                  transition: "width 1s linear, background 0.4s",
                }}
              />
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
              FragReel é 100% gratuito · sustentado por anúncios
            </div>

            {canDownload ? (
              <button
                onClick={handleDownload}
                className="btn-primary"
                style={{ fontSize: 14, padding: "10px 26px", animation: "adSlide 0.3s ease" }}
              >
                ⬇ Baixar Frag Reel
              </button>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                {renderDone && !adDone
                  ? `Aguarde o fim do anúncio · ${adRemaining}s`
                  : !renderDone && adDone
                  ? "Renderização em andamento..."
                  : "O botão aparece quando terminar"}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
