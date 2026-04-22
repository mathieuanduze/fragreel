"use client";

import { useEffect, useState } from "react";
import { getLocalJob, LocalJob } from "@/lib/local";

const AD_DURATION = 30;
// Mínimo de segundos de anúncio totais que o usuário precisa assistir antes
// do botão "Editar vídeo" aparecer. Igual a 1 ad completo (30s) — mesmo que
// a análise ainda esteja rolando, basta ter visto 30s acumulados.
const MIN_AD_SECONDS = AD_DURATION;

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
];

type Props = {
  sha: string;
  mapName: string;
  onClose: () => void;
  onReady: (matchId: string) => void;
};

export default function AnalyzeModal({ sha, mapName, onClose, onReady }: Props) {
  const [adElapsed, setAdElapsed] = useState(0);
  const [adIndex, setAdIndex] = useState(0);
  // Total cumulativo de segundos de ads vistos (sobrevive à rotação entre ads).
  const [totalAdSeconds, setTotalAdSeconds] = useState(0);
  const [job, setJob] = useState<LocalJob | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Polling do status no client local
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await getLocalJob(sha);
        if (!cancelled && j) setJob(j);
      } catch (e) {
        if (!cancelled) setPollError((e as Error).message);
      }
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => { cancelled = true; clearInterval(id); };
  }, [sha]);

  const analyzeDone = job?.event === "done";
  const analyzeFailed = job?.event === "failed";
  const adDone = totalAdSeconds >= MIN_AD_SECONDS;
  const canProceed = analyzeDone && adDone;
  const adRemainingThis = Math.max(0, AD_DURATION - adElapsed);
  const adProgress = Math.min(1, adElapsed / AD_DURATION);
  // Progresso até desbloquear o botão (usa totalAdSeconds, não adElapsed)
  const totalAdRemaining = Math.max(0, MIN_AD_SECONDS - totalAdSeconds);
  const adCount = adIndex + 1;

  // Ad timer (back-to-back se análise ainda rolando)
  useEffect(() => {
    const id = setInterval(() => {
      setAdElapsed((e) => {
        const next = e + 1;
        if (next >= AD_DURATION) {
          if (!analyzeDone) {
            setAdIndex((i) => (i + 1) % ADS.length);
            return 0;
          }
          return AD_DURATION;
        }
        return next;
      });
      // Acumula tempo total assistido — só conta enquanto não bateu o mínimo,
      // ou se análise ainda tá rolando (continua passando ads).
      setTotalAdSeconds((t) => {
        if (t >= MIN_AD_SECONDS && analyzeDone) return t;
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [analyzeDone]);

  const ad = ADS[adIndex];

  const statusLine = (() => {
    if (analyzeFailed) return `❌ Falhou: ${job?.error || "erro desconhecido"}`;
    if (analyzeDone) return `✓ Análise pronta — ${job?.highlights ?? 0} highlights detectados`;
    if (job?.event === "uploading") return `⬆ Enviando demo (tentativa ${job.attempt ?? 1})…`;
    if (job?.event === "queued") return "⏳ Na fila…";
    if (pollError) return `⚠ Cliente offline — abra o FragReel no PC`;
    return "Iniciando análise…";
  })();

  // Tentou fechar — se já tem botão liberado, fecha direto. Senão, pede confirmação.
  const handleCloseAttempt = () => {
    if (canProceed || analyzeFailed) onClose();
    else setConfirmClose(true);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.94)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: "adFadeIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes adFadeIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes adSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 680, position: "relative" }}>
        {/* Botão X — sempre disponível (sai do modal de análise = aborta) */}
        <button
          onClick={handleCloseAttempt}
          aria-label="Fechar análise"
          title={canProceed ? "Fechar" : "Cancelar análise"}
          style={{
            position: "absolute", top: -8, right: -8, zIndex: 2,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(20,20,32,0.9)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 16, fontWeight: 700,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
            PUBLICIDADE · Anúncio {adCount} · enquanto sua partida é analisada
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>{adRemainingThis}s restantes</div>
        </div>

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
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: 18, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38 }}>{ad.icon}</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginBottom: 10, letterSpacing: "-0.02em" }}>{ad.brand}</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", maxWidth: 380, lineHeight: 1.6 }}>{ad.tagline}</div>
              <div style={{ marginTop: 14, fontSize: 13, color: "#4a9eff", fontWeight: 600, letterSpacing: "0.04em" }}>{ad.url}</div>
            </div>
          </div>

          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4444", display: "inline-block", animation: "pulse 1s infinite" }} />
            0:{String(adRemainingThis).padStart(2, "0")}
          </div>
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>PATROCINADO</div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ height: "100%", width: `${adProgress * 100}%`, background: "rgba(255,255,255,0.3)", transition: "width 1s linear" }} />
          </div>
        </div>

        <div
          style={{
            marginTop: 12, padding: "18px 22px",
            background: "#13131f",
            border: `1px solid ${canProceed ? "rgba(76,175,130,0.4)" : analyzeFailed ? "rgba(255,80,80,0.4)" : "#2D2D44"}`,
            borderRadius: 12,
            transition: "border-color 0.4s",
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: analyzeDone ? "#4CAF82" : analyzeFailed ? "#ff6666" : "rgba(255,255,255,0.7)" }}>
                {mapName} · {statusLine}
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: analyzeDone ? "100%" : job?.event === "uploading" ? "70%" : "30%",
                  background: analyzeDone
                    ? "linear-gradient(90deg, #4CAF82, #2ecc71)"
                    : "linear-gradient(90deg, #FF6B35, #ff9966)",
                  borderRadius: 999,
                  transition: "width 1s ease, background 0.4s",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
              FragReel é 100% gratuito · sustentado por anúncios
            </div>
            {canProceed ? (
              <button onClick={() => onReady(job!.match_id!)} className="btn-primary" style={{ fontSize: 14, padding: "10px 26px", animation: "adSlide 0.3s ease" }}>
                ✏️ Editar vídeo
              </button>
            ) : analyzeFailed ? (
              <button onClick={onClose} className="btn-secondary" style={{ fontSize: 13, padding: "8px 20px" }}>Fechar</button>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                {analyzeDone && !adDone
                  ? `Aguarde ${totalAdRemaining}s pro botão liberar`
                  : !analyzeDone && adDone
                  ? "Análise rodando · botão libera assim que terminar"
                  : `${totalAdRemaining}s de anúncio antes de liberar`}
              </div>
            )}
          </div>
        </div>

        {/* Confirmação de cancelamento */}
        {confirmClose && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 10,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            animation: "adFadeIn 0.15s ease",
          }}
          onClick={() => setConfirmClose(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 380,
                background: "#13131f",
                border: "1px solid #2D2D44",
                borderRadius: 14,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Cancelar análise?
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 18 }}>
                Sua demo já foi enviada e a IA está processando. Se você fechar agora,
                <b> o vídeo não vai ser gerado</b> e você terá que assistir o anúncio de novo
                pra recomeçar.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                >
                  Continuar assistindo
                </button>
                <button
                  onClick={() => { setConfirmClose(false); onClose(); }}
                  style={{
                    fontSize: 13, padding: "8px 16px",
                    background: "transparent",
                    border: "1px solid rgba(255,80,80,0.45)",
                    color: "#ff7066",
                    borderRadius: 8, cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Sim, cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
