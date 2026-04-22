"use client";

import { useEffect, useState, useCallback } from "react";
import { getRenderStatus, RenderStatus } from "@/lib/api";
import { getLocalRenderStatus, type LocalRenderSession } from "@/lib/local";

const AD_DURATION = 30;
// Render é mais pesado que análise — exige 2 ads completos (60s cumulativos)
// antes do botão "Baixar" liberar. Se o user já assistiu 2+ ads e o render
// ainda tá rodando, NÃO precisa esperar terminar o 3º ad — o gate só checa
// totalAdSeconds >= MIN_AD_SECONDS.
const MIN_AD_SECONDS = AD_DURATION * 2;

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
  downloadUrl?: string | null;
  matchId?: string;
  format?: string;
  /** True when the render runs on the user's PC via local_api.
   *  In that mode we poll /render/status on 127.0.0.1 and the output
   *  lands on the Desktop — no "download" button, just an "open folder"
   *  CTA once state=done. */
  localRenderMode?: boolean;
};

function fmtTime(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, "0")}s`;
  return `${sec}s`;
}

export default function AdModal({ onClose, formatLabel, renderDuration, downloadUrl, matchId, format, localRenderMode }: AdModalProps) {
  const [adElapsed, setAdElapsed]       = useState(0);
  const [adIndex, setAdIndex]           = useState(0);
  const [totalAdSeconds, setTotalAdSeconds] = useState(0);
  const [renderElapsed, setRenderElapsed] = useState(0);
  const [closing, setClosing]           = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [downloaded, setDownloaded]     = useState(false);
  const [serverStatus, setServerStatus] = useState<RenderStatus | null>(null);
  const [localStatus, setLocalStatus]   = useState<LocalRenderSession | null>(null);

  // Poll render status every 2s. When running locally (on the user's PC)
  // we poll 127.0.0.1:5775/render/status — the real rendering is happening
  // right there, CS2 hidden offscreen, frames accumulating. Otherwise we
  // fall back to the server path.
  useEffect(() => {
    if (localRenderMode) {
      const id = setInterval(async () => {
        try {
          const s = await getLocalRenderStatus();
          if ("render_id" in s) {
            setLocalStatus(s);
            if (s.state === "done" || s.state === "error" || s.state === "cancelled") {
              clearInterval(id);
            }
          }
        } catch {
          // client may have briefly hiccupped; keep trying
        }
      }, 2000);
      return () => clearInterval(id);
    }
    if (!matchId || !format) return;
    const id = setInterval(async () => {
      try {
        const s = await getRenderStatus(matchId, format);
        setServerStatus(s);
        if (s.status === "done" || s.status === "error") clearInterval(id);
      } catch {
        // status ainda não pronto, segue tentando
      }
    }, 3000);
    return () => clearInterval(id);
  }, [localRenderMode, matchId, format]);

  // renderDone EXIGE confirmação. Local: state==='done'. Server: status==='done'.
  const renderDone = localRenderMode
    ? localStatus?.state === "done"
    : serverStatus?.status === "done";
  // Tempo estimado já passou? Mostra mensagem honesta "estamos finalizando".
  const renderOvertime = renderElapsed >= renderDuration;
  const adDone        = totalAdSeconds >= MIN_AD_SECONDS;
  const canDownload   = renderDone && adDone;
  const adRemainingThis = Math.max(0, AD_DURATION - adElapsed);
  const totalAdRemaining = Math.max(0, MIN_AD_SECONDS - totalAdSeconds);
  const adProgress    = Math.min(1, adElapsed / AD_DURATION);
  // Barra visual: local usa progresso real (frames capturados), server usa
  // estimativa de tempo. Ambos: quando NÃO está done, cap em 95% pra evitar
  // "100% mas vídeo não pronto".
  const visualRenderPct = renderDone
    ? 1
    : localRenderMode && localStatus
      ? Math.min(0.95, Math.max(0.02, localStatus.progress))
      : Math.min(0.95, renderElapsed / renderDuration);
  const renderRemaining = Math.max(0, renderDuration - renderElapsed);
  const adCount       = adIndex + 1;
  const adsWatched    = Math.floor(totalAdSeconds / AD_DURATION);

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
          // Render já terminou: trava o ad em AD_DURATION
          return AD_DURATION;
        }
        return next;
      });
      // Acumula segundos totais — para de contar quando bate o mínimo E render done
      setTotalAdSeconds((t) => {
        if (t >= MIN_AD_SECONDS && renderDone) return t;
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [renderDone]);

  // Render timer — counts up. NÃO trava em renderDuration porque a gente
  // usa renderElapsed pra calcular o `grace` (renderDuration * 1.5).
  useEffect(() => {
    if (renderDone) return;
    const id = setInterval(() => {
      setRenderElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [renderDone]);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    if (!downloadUrl) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      // Fetch primeiro pra validar — evita o caso "abriu nova página com
      // {"detail":"render ainda não disponível"}" que tirou o user do app.
      const res = await fetch(downloadUrl, { cache: "no-store" });
      if (!res.ok) {
        // 404/425/etc — renderização ainda não pronta no servidor.
        let detail = `${res.status}`;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch {
          /* não-JSON */
        }
        throw new Error(detail);
      }
      const ctype = res.headers.get("content-type") || "";
      // Resposta não é vídeo? (HTML/JSON) → trata como erro.
      if (ctype.includes("application/json") || ctype.includes("text/html")) {
        const txt = await res.text();
        throw new Error(`resposta inesperada do servidor: ${txt.slice(0, 80)}`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      // Nome do arquivo: tenta extrair do Content-Disposition; fallback genérico.
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
      const fname = m ? decodeURIComponent(m[1]) : `fragreel-${matchId ?? "video"}.mp4`;
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fname;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Libera o blob depois de 60s (tempo + que suficiente pro browser pegar).
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
      setDownloaded(true);
    } catch (e) {
      setDownloadError((e as Error).message || "falha ao baixar");
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl, matchId]);

  const handleCloseAttempt = () => {
    // Já baixou → fecha direto.
    if (downloaded) {
      setClosing(true);
      setTimeout(onClose, 300);
      return;
    }
    // Render rolando OU ads não-completos → confirma. User pediu feedback de
    // "vai perder o progresso" tanto no ad quanto durante a renderização.
    setConfirmClose(true);
  };

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

      <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>

        {/* Botão X */}
        <button
          onClick={handleCloseAttempt}
          aria-label="Fechar"
          title={canDownload || downloaded ? "Fechar" : "Cancelar geração do vídeo"}
          style={{
            position: "absolute", top: -12, right: -12, zIndex: 2,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(20,20,32,0.9)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 16, fontWeight: 700,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
            PUBLICIDADE · Anúncio {adCount} · enquanto seu vídeo renderiza
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
            {adRemainingThis}s restantes
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

          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4444", display: "inline-block", animation: "pulse 1s infinite" }} />
            0:{String(adRemainingThis).padStart(2, "0")}
          </div>

          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
            PATROCINADO
          </div>

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
          {/* Render progress */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: renderDone ? "#4CAF82" : "rgba(255,255,255,0.7)" }}>
                {renderDone ? `✓ ${formatLabel} pronto!`
                  : renderOvertime ? `⚙️ ${formatLabel} — finalizando no servidor…`
                  : `⚙️ Renderizando ${formatLabel}…`}
              </div>
              <div style={{ fontSize: 12, color: renderDone ? "#4CAF82" : "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                {renderDone
                  ? "100%"
                  : renderOvertime
                    ? `~${fmtTime(renderElapsed)} decorridos`
                    : `${Math.round(visualRenderPct * 100)}% · ${fmtTime(renderRemaining)} restantes`}
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${visualRenderPct * 100}%`,
                  background: renderDone
                    ? "linear-gradient(90deg, #4CAF82, #2ecc71)"
                    : "linear-gradient(90deg, #FF6B35, #ff9966)",
                  borderRadius: 999,
                  transition: "width 1s linear, background 0.4s",
                }}
              />
            </div>
            {/* Sub-line: anúncios assistidos */}
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.35)", display: "flex", justifyContent: "space-between" }}>
              <span>📺 {adsWatched}/2 anúncios assistidos {adDone && "✓"}</span>
              {!adDone && <span>{totalAdRemaining}s pro botão liberar</span>}
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
              FragReel é 100% gratuito · sustentado por anúncios
            </div>

            {/* Botão SEMPRE presente — não-clicável até estar pronto.
                User pediu: "o botão de gerar fragreel tem que estar no ad o tempo
                todo, mas não como clicável, ajude o usuário a entender o processo." */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={canDownload && !downloading ? handleDownload : undefined}
                disabled={!canDownload || downloading}
                title={
                  canDownload
                    ? "Baixar agora"
                    : !renderDone
                      ? "Esperando o vídeo terminar de renderizar"
                      : `Faltam ${totalAdRemaining}s de anúncio`
                }
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "10px 26px",
                  borderRadius: 8,
                  border: "none",
                  background: canDownload ? "#FF6B35" : "rgba(255,107,53,0.25)",
                  color: canDownload ? "white" : "rgba(255,255,255,0.5)",
                  cursor: canDownload && !downloading ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  transition: "background 0.3s",
                }}
              >
                {downloading ? "Baixando…" : downloaded ? "⬇ Baixar de novo" : "⬇ Baixar FragReel"}
              </button>
              {downloaded && (
                <button
                  onClick={() => { setClosing(true); setTimeout(onClose, 300); }}
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: "10px 18px" }}
                >
                  Fechar
                </button>
              )}
            </div>
          </div>

          {/* Estado abaixo do botão */}
          {!canDownload && (
            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.4)", fontStyle: "italic", textAlign: "right" }}>
              {renderDone && !adDone
                ? `Vídeo pronto · ${totalAdRemaining}s de anúncio antes de liberar`
                : !renderDone && adDone
                  ? "Anúncios OK · esperando renderização terminar"
                  : renderOvertime
                    ? "Renderização demorando mais que o esperado — só libera quando o servidor confirmar"
                    : "O botão libera quando o vídeo e os anúncios terminarem"}
            </div>
          )}
          {downloadError && (
            <div style={{
              marginTop: 10, padding: "10px 12px",
              fontSize: 12, color: "#ffb088",
              background: "rgba(255,150,80,0.08)",
              border: "1px solid rgba(255,150,80,0.3)",
              borderRadius: 8,
            }}>
              <b>Não rolou baixar agora:</b> {downloadError}. O vídeo pode ainda estar
              finalizando — aguarde alguns segundos e clique de novo.
            </div>
          )}
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
                maxWidth: 400,
                background: "#13131f",
                border: "1px solid #2D2D44",
                borderRadius: 14,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                {renderDone ? "Fechar antes de baixar?" : "Cancelar geração do vídeo?"}
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 18 }}>
                {renderDone ? (
                  <>O vídeo já está pronto — se fechar agora, <b>não baixa</b>.
                  Pra liberar o download de novo, você vai precisar assistir
                  os anúncios outra vez.</>
                ) : (
                  <>Se fechar agora, <b>todo o progresso é perdido</b>: o
                  contador de anúncios zera e você precisa começar do início.
                  A renderização continua no servidor — mas pra baixar, vai
                  ter que reabrir o fluxo e assistir os anúncios de novo.</>
                )}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                >
                  {renderDone ? "Voltar e baixar" : "Continuar assistindo"}
                </button>
                <button
                  onClick={() => { setConfirmClose(false); setClosing(true); setTimeout(onClose, 300); }}
                  style={{
                    fontSize: 13, padding: "8px 16px",
                    background: "transparent",
                    border: "1px solid rgba(255,80,80,0.45)",
                    color: "#ff7066",
                    borderRadius: 8, cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Sim, perder progresso
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
