"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getRenderStatus, RenderStatus } from "@/lib/api";
import {
  getLocalRenderStatus,
  openLocalRenderOutput,
  type LocalRenderSession,
} from "@/lib/local";

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
  /** Sprint v5.7 (08/05/2026 Mathieu spec): "Gerei 2 fragreels, nenhum
   *  deles mostram em meus fragreels". Callback fires UMA VEZ quando
   *  render local conclui com sucesso (state="done" + output_mp4 set).
   *  MatchClient usa pra gravar em recentRender (Meus FragReels) +
   *  clear edit draft. */
  onRenderComplete?: (mp4Path: string) => void;
};

function fmtTime(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, "0")}s`;
  return `${sec}s`;
}

export default function AdModal({ onClose, formatLabel, renderDuration, downloadUrl, matchId, format, localRenderMode, onRenderComplete }: AdModalProps) {
  const [adElapsed, setAdElapsed]       = useState(0);
  const [adIndex, setAdIndex]           = useState(0);
  const [totalAdSeconds, setTotalAdSeconds] = useState(0);
  const [renderElapsed, setRenderElapsed] = useState(0);
  const [closing, setClosing]           = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [downloaded, setDownloaded]     = useState(false);
  const [serverStatus, setServerStatus] = useState<RenderStatus | null>(null);
  const [localStatus, setLocalStatus]   = useState<LocalRenderSession | null>(null);
  // Mock da barra de edição: Remotion ainda não está plugado no client
  // (editor_dir não resolve dentro do .exe — bug separado), então a 3ª
  // barra é puramente visual hoje. Quando Remotion entrar de verdade,
  // troca esse contador por sinal real do backend (hook do remotion render).
  // Duração escolhida a olho — Remotion compor uma cena típica leva ~20-25s.
  // Bug #23 (28/04, PC test v0.4.6): mockEditElapsed removido. Antes era
  // usado pra edit progress bar com `/ 20s` mas Remotion real demora 1-10min.
  // Substituído por mapping linear do backend.progress (ver editRaw abaixo).

  // Poll render status every 2s. When running locally (on the user's PC)
  // we poll 127.0.0.1:5775/render/status — the real rendering is happening
  // right there, CS2 hidden offscreen, frames accumulating. Otherwise we
  // fall back to the server path.
  // Snapshot do timestamp de quando AdModal montou. Usamos pra descartar
  // stale "done" sessions de renders anteriores (started_at < adModalMountTs).
  // 05/05: Mathieu reportou bars 100% imediato no retry pós-CS-busy. Backend
  // já tem fix (clear terminal session em start()), mas defensive frontend
  // também ajuda em race conditions ou client antigo sem o fix.
  const adModalMountTs = useState(() => Date.now() / 1000)[0];

  useEffect(() => {
    if (localRenderMode) {
      const id = setInterval(async () => {
        try {
          const s = await getLocalRenderStatus();
          if ("render_id" in s) {
            // Defensive: se session é terminal (done/error/cancelled) MAS
            // started_at < quando AdModal montou, é o RENDER ANTERIOR — não
            // poluir UI com bars 100%. Aguarda próximo poll que pega o NOVO.
            const sessionStartedAt = s.started_at ?? 0;
            const isStaleDone =
              (s.state === "done" || s.state === "error" || s.state === "cancelled") &&
              sessionStartedAt > 0 &&
              sessionStartedAt < adModalMountTs - 1; // 1s tolerância
            if (isStaleDone) {
              // Skip — session é do render anterior, novo ainda começando
              return;
            }
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
  // ── Pipeline em 3 etapas (modo local) ────────────────────────────────────
  // O backend reporta `state` ∈ {staging, launching, capturing, converting,
  // rendering, done}. v0.2.11 separou em 3 barras (pedido do user no v0.2.10
  // testing: "podemos adicionar uma 3a barra, no meio das duas de
  // renderização, que de fato aconteça durante a renderização dos vídeos.
  // Aí, a de edição, será para quando o remotion estiver editando a cena").
  //
  //   1. Captura (HLAE)        — staging | launching | capturing
  //                               progress = frames_captured / frames_expected
  //   2. Render (ffmpeg ProRes) — converting
  //                               progress = segments_done / segments_total
  //                               (real! emitido pelo backend a cada .mov pronto)
  //   3. Edição (Remotion MP4)  — rendering
  //                               progress = mock por enquanto (Remotion ainda
  //                               não emite hook de progresso — ver
  //                               MOCK_EDIT_DURATION abaixo)
  const localState = localStatus?.state;
  const isCapturePhase =
    localState === "staging" || localState === "launching" || localState === "capturing";
  const isRenderPhase = localState === "converting";
  const isEditPhase   = localState === "rendering";
  // Etapa 1 — Captura (HLAE): completa quando saiu da fase de captura.
  // Durante a captura usa o `progress` reportado (= frames_captured/expected),
  // capado em 0.99 pra não mostrar "100%" enquanto state ainda é "capturing".
  //
  // v0.2.9 regressão: multi-segment renders alternam o state entre
  // capturing → converting → capturing (uma vez por take, porque a conversão
  // pra ProRes acontece streaming durante a captura do próximo segmento).
  // Antes do v0.2.10 o frontend reagia a essas transições com capturePct
  // = 1 quando converting, = progress quando capturing — o que fazia a
  // barra pular pra 100%, voltar pra 40%, 100%, 40%… (ping-pong).
  // Solução: monotônico via max() acumulado (ver useEffect abaixo).
  const captureRaw = !localRenderMode
    ? renderDone ? 1 : Math.min(0.95, renderElapsed / renderDuration)
    : !localStatus
      ? 0
      : isCapturePhase
        ? Math.min(0.99, Math.max(0.02, localStatus.progress))
        : 1; // converting/rendering/done → captura terminou
  // Etapa 2 — Render (ffmpeg ProRes). Esta é a única fase com sinal de
  // progresso REAL hoje: o backend emite segments_done/segments_total a
  // cada .mov finalizado. Antes da fase de render começar, fica em 0;
  // durante, vai por segments; depois (rendering/done) trava em 1.
  const totalSegs = localStatus?.segments_total ?? 0;
  const doneSegs  = localStatus?.segments_done ?? 0;
  const renderRaw = !localRenderMode
    ? 0 // server mode: pipeline é um só, não faz sentido split
    : !localStatus || isCapturePhase
      ? 0
      : isRenderPhase
        ? totalSegs > 0
          ? Math.min(0.99, Math.max(0.02, doneSegs / totalSegs))
          // Backend antigo (<= v0.2.7) não emite segments_total — degrada
          // pra fração linear baseada no tempo desde o entrou em converting.
          // Não temos timestamp da transição aqui então usa um valor neutro
          // pra mostrar "tá rolando" sem fingir progresso preciso.
          : 0.5
        : 1; // rendering/done → render terminou
  // Etapa 3 — Edição (Remotion).
  //
  // Bug #23 (28/04, PC test v0.4.6): substituído MOCK por progress real do
  // backend. v0.4.5 e anteriores usavam `mockEditElapsed / 20s capped at
  // 0.95` — chave assumia Remotion levaria ~20s. Realidade no PC test foi
  // 10min 31s (24× a estimativa). Resultado: barra cravava 95% em 20s e
  // ficava lá por 10 min enquanto backend evoluía 0.89→0.99. Mathieu
  // percebeu como "+6pp off" ou "stuck 95%" — confundiu diagnose 2x.
  //
  // Fix: mapeia backend.progress (0.89-1.0 durante rendering) → 0-1 da
  // barra. Backend.progress é REAL (Remotion não emite hook fino mas o
  // global vai subindo conforme stages). Constantes vêm de
  // render_coordinator.py: STAGING(.03) + LAUNCHING(.04) + CAPTURING(.70)
  // + CONVERTING(.12) = 0.89.
  const RENDERING_BUDGET_START = 0.89;
  const editRaw = !localRenderMode
    ? renderDone ? 1 : 0
    : !localStatus || isCapturePhase || isRenderPhase
      ? 0
      : renderDone
        ? 1
        : Math.min(
            0.99,
            Math.max(
              0,
              (localStatus.progress - RENDERING_BUDGET_START) /
                (1.0 - RENDERING_BUDGET_START),
            ),
          );
  // Monotonic clamp: cada barra só sobe, nunca desce. Pinned em 1 quando
  // renderDone. Evita o ping-pong descrito acima e também o "barra voltou
  // pra 95% depois de ficar em 100%" causado pela troca de label no final.
  //
  // Bug #23 V2 (28/04 PC test): UI mostrava "Edição 95%" sustained, depois
  // CAÍA pra 0% durante phase ativa do Remotion. Backend nunca regrediu
  // (0.85 → 0.89 → 1.0 monotônico). 3 root causes identificadas:
  //
  //   A. useState reset on remount: AdModal é {showAd && <AdModal />}, se
  //      showAd toggle ou parent re-render causa remount, maxEditPct
  //      volta pra 0. monotonic protection ANTERIOR só funcionava DENTRO
  //      do mesmo mount.
  //
  //   B. editRaw fórmula retornava 0 quando progress < RENDERING_BUDGET_START.
  //      Quando state=="rendering" mas progress momentaneamente em 0.85
  //      (race entre state transition e progress update no backend),
  //      editRaw=0, e se mount foi novo, maxEditPct=0 também → UI mostra 0%.
  //
  //   C. Floor by phase ausente: durante editing phase, capturePct e
  //      renderPct deveriam ser SEMPRE 1 (passaram), e editPct ≥ algum
  //      mínimo ("iniciando" 5%) pra UI nunca ficar em 0% em fase ativa.
  //
  // Fix combinado:
  //   1. useRef pra persistir max values (não reseta em re-render)
  //   2. Initial value calculado de localStatus inicial (não zero)
  //   3. Phase-aware floor: editPct mínimo 0.02 quando isEditPhase
  //   4. capturePct/renderPct = 1 quando phase posterior ativa
  const maxCaptureRef = useRef(0);
  const maxRenderRef = useRef(0);
  const maxEditRef = useRef(0);
  // useState pra trigger re-render quando refs atualizam
  const [, forceTick] = useState(0);

  useEffect(() => {
    let changed = false;
    if (captureRaw > maxCaptureRef.current) {
      maxCaptureRef.current = captureRaw;
      changed = true;
    }
    if (renderRaw > maxRenderRef.current) {
      maxRenderRef.current = renderRaw;
      changed = true;
    }
    if (editRaw > maxEditRef.current) {
      maxEditRef.current = editRaw;
      changed = true;
    }
    if (changed) forceTick((t) => t + 1);
  }, [captureRaw, renderRaw, editRaw]);

  // Phase-aware floor: garante que UI nunca regride em phase ativa.
  // Se editPhase ativa MAS editRaw cálculo der 0 (progress ainda em
  // RENDERING_BUDGET_START boundary), mostra mínimo 2% pra user ver
  // "começou edição".
  const captureFloor = (isRenderPhase || isEditPhase) ? 1 : 0;
  const renderFloor = isEditPhase ? 1 : 0;
  const editFloor = (isEditPhase && !renderDone) ? 0.02 : 0;

  const capturePct = renderDone ? 1 : Math.max(maxCaptureRef.current, captureFloor);
  const renderPct  = renderDone ? 1 : Math.max(maxRenderRef.current, renderFloor);
  const editPct    = renderDone ? 1 : Math.max(maxEditRef.current, editFloor);
  // Modo server: só uma barra faz sentido (não tem split de stages).
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

  // Bug #23 (28/04): useEffect do mockEditElapsed timer removido — não é
  // mais necessário porque editRaw agora vem do backend.progress real.
  // Histórico: v0.2.10/v0.2.11 usavam mock pq Remotion não emitia progresso
  // fino. v0.4.6 comprovou que o progress GLOBAL do backend (0.89→0.99
  // durante rendering stage) já é suficiente pra UI sem precisar emitter
  // dedicado do Remotion.

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pathCopied, setPathCopied] = useState(false);

  // In local-render mode the .mp4 lands on the user's Desktop. Browsers
  // can't open OS folders directly (file:// to a dir is blocked since 2019),
  // so we surface the absolute path + a "copy" button. Falls back to the
  // first .mov if Remotion didn't run (e.g. ffmpeg present but Remotion
  // skipped — user still has gameplay clips on disk).
  const localOutputPath =
    localStatus?.output_mp4 ??
    localStatus?.output_movs?.[0] ??
    localStatus?.output_mov ??
    null;
  const localOutputDir = localOutputPath
    ? localOutputPath.replace(/[\\/][^\\/]+$/, "")
    : null;

  // Sprint v5.7 — fire onRenderComplete UMA vez quando render local
  // termina com sucesso. Guarded contra re-fires via ref (state-based
  // useEffect deps faria re-fire se setRecentRender atualizasse o
  // localStatus indireto). MatchClient usa pra setRecentRender (Meus
  // FragReels) + clearEditDraft.
  const completeFiredRef = useRef(false);
  useEffect(() => {
    if (
      !completeFiredRef.current &&
      localStatus?.state === "done" &&
      localOutputPath &&
      onRenderComplete
    ) {
      completeFiredRef.current = true;
      onRenderComplete(localOutputPath);
    }
  }, [localStatus?.state, localOutputPath, onRenderComplete]);

  const copyOutputPath = useCallback(async () => {
    if (!localOutputDir) return;
    try {
      await navigator.clipboard.writeText(localOutputDir);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (insecure context, perms) — at least
      // the path is visible in the chip so user can select-and-copy.
      setPathCopied(false);
    }
  }, [localOutputDir]);

  // "Abrir FragReel" — usa o novo endpoint /render/open (v0.2.9+) pra abrir
  // o vídeo no app default do Windows (Reprodutor de Mídia, etc). Browser
  // não consegue invocar `os.startfile` direto — tem que ir pelo client.
  // Se o endpoint não existir (cliente velho), a gente cai pro path-copy
  // e avisa o user no chip.
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening]     = useState(false);
  const handleOpenOutput = useCallback(async () => {
    if (!localOutputPath) return;
    setOpening(true);
    setOpenError(null);
    try {
      const r = await openLocalRenderOutput();
      if (!r.opened) {
        // Backend respondeu mas não conseguiu abrir — cai pro copy.
        setOpenError(r.reason || "não abriu — copie o caminho abaixo");
        copyOutputPath();
      }
    } catch (e) {
      // Endpoint 404 (client antigo) ou erro de rede — degrada pro copy.
      setOpenError(
        (e as Error).message?.includes("404")
          ? "atualize o FragReel client pra abrir direto · copiei o caminho"
          : (e as Error).message,
      );
      copyOutputPath();
    } finally {
      setOpening(false);
    }
  }, [localOutputPath, copyOutputPath]);

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

  // ── Bug #20 (28/04, PC test) — early return UI de erro ─────────────────────
  // PC reportou: backend retornava state=error/stage=failed após ENOSPC
  // mas UI continuava mostrando "Edição 95%" estático por 18+ minutos.
  // Causa: detect de error só fazia clearInterval (linha 92) sem mudar UI.
  // Fix: quando state===error, abandonar pipeline UI normal e mostrar tela
  // explícita de falha com mensagem do backend + ações claras.
  const renderErrored = localRenderMode && localStatus?.state === "error";
  const renderErrorMsg = renderErrored
    ? (localStatus?.error ?? localStatus?.stage ?? "render falhou")
    : null;
  // Traduzir mensagens técnicas comuns pra português user-friendly.
  const renderErrorFriendly = (() => {
    if (!renderErrorMsg) return null;
    const m = renderErrorMsg.toLowerCase();
    if (m.includes("enospc") || m.includes("no space left") || m.includes("disco quase cheio")) {
      return "Disco cheio durante a captura. Libere ~50 GB e tente de novo.";
    }
    if (m.includes("cannot find module") || m.includes("module_not_found")) {
      return "Bundle Remotion incompleto. Reinstale o FragReel da última release.";
    }
    if (m.includes("cs2") && m.includes("crash")) {
      return "CS2 crashou durante a captura. Tente de novo (geralmente é transitório).";
    }
    if (m.includes("timeout") || m.includes("hlae")) {
      return "Timeout durante a captura HLAE. CS2 pode ter ficado travado — feche o CS2 manualmente e tente de novo.";
    }
    return null;
  })();

  if (renderErrored) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.94)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%", maxWidth: 540,
            background: "#131325",
            border: "1px solid rgba(224,85,85,0.4)",
            borderRadius: 12,
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: "#E8E8F0" }}>
            Render falhou
          </h2>
          {renderErrorFriendly && (
            <p style={{ fontSize: 15, color: "#E8E8F0", lineHeight: 1.6, marginBottom: 12 }}>
              {renderErrorFriendly}
            </p>
          )}
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginBottom: 24, fontFamily: "monospace", wordBreak: "break-word" }}>
            {renderErrorMsg}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => { setClosing(true); setTimeout(onClose, 300); }}
              style={{
                padding: "12px 24px",
                background: "#FF6B35",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              ← Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }
  // ── /Bug #20 ───────────────────────────────────────────────────────────────

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
          {/* Render progress — TRÊS barras consecutivas em modo local
              (captura HLAE → render ffmpeg → edição Remotion). Modo server
              colapsa em uma só (não tem split de stages).
              v0.2.11: split antiga "Edição" → "Render" + "Edição" porque
              o user pediu visibilidade do que rola entre captura e o
              composer Remotion. */}
          <div style={{ marginBottom: 14 }}>
            {localRenderMode ? (
              <>
                {/* Etapa 1 — Captura in-game */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: capturePct >= 1 ? "#4CAF82" : "rgba(255,255,255,0.7)" }}>
                      {capturePct >= 1 ? "✓ Captura concluída" : "🎮 Capturando gameplay (CS2 + HLAE)…"}
                    </div>
                    <div style={{ fontSize: 12, color: capturePct >= 1 ? "#4CAF82" : "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                      {Math.round(capturePct * 100)}%
                    </div>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${capturePct * 100}%`,
                        background: capturePct >= 1
                          ? "linear-gradient(90deg, #4CAF82, #2ecc71)"
                          : "linear-gradient(90deg, #FF6B35, #ff9966)",
                        borderRadius: 999,
                        transition: "width 1s linear, background 0.4s",
                      }}
                    />
                  </div>
                </div>
                {/* Etapa 2 — Render ffmpeg (TGA → ProRes .mov por highlight).
                    Sinal REAL: backend emite segments_done/segments_total a
                    cada .mov fechado. Antes do v0.2.11 essa fase ficava
                    invisível (era colapsada em "Edição"), o que confundia
                    o user que via "Editando…" mas nada acontecendo na UI
                    durante 30-60s de ffmpeg. */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: renderPct >= 1 ? "#4CAF82"
                        : isRenderPhase ? "rgba(255,255,255,0.7)"
                        : "rgba(255,255,255,0.35)",
                    }}>
                      {renderPct >= 1 ? "✓ Render dos clips concluído"
                        : isRenderPhase
                          ? totalSegs > 0
                            // v0.2.15 UX Ponto 4: doneSegs pode vir como float
                            // (ex.: 1.247) quando o coordinator reporta
                            // progresso intra-segmento pra a barra ficar
                            // suave. No texto queremos "1/3", não "1.247/3"
                            // — Math.floor porque estamos em "quantos já
                            // fecharam" (ainda não contou o que está em
                            // andamento), não "quantos estamos próximos de".
                            ? `🎞️ Renderizando clips (${Math.floor(doneSegs)}/${totalSegs})…`
                            : "🎞️ Renderizando clips em ProRes…"
                          : "Render — aguardando captura"}
                    </div>
                    <div style={{ fontSize: 12, color: renderPct >= 1 ? "#4CAF82" : "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                      {Math.round(renderPct * 100)}%
                    </div>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${renderPct * 100}%`,
                        background: renderPct >= 1
                          ? "linear-gradient(90deg, #4CAF82, #2ecc71)"
                          : "linear-gradient(90deg, #4a9eff, #6dc1ff)",
                        borderRadius: 999,
                        transition: "width 1s linear, background 0.4s",
                      }}
                    />
                  </div>
                </div>
                {/* Etapa 3 — Edição/composição Remotion. Placeholder visual
                    enquanto Remotion ainda não está plugado no .exe (bug
                    separado: editor_dir não resolve dentro do PyInstaller).
                    Quando entrar de verdade, troca o mock timer por hook
                    do remotion render --out-frame stdout. */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: renderDone ? "#4CAF82"
                        : isEditPhase ? "rgba(255,255,255,0.7)"
                        : "rgba(255,255,255,0.35)",
                    }}>
                      {renderDone ? `✓ ${formatLabel} pronto!`
                        : isEditPhase ? `✏️ Editando ${formatLabel} (Remotion)…`
                        : "Edição — aguardando render"}
                    </div>
                    <div style={{ fontSize: 12, color: renderDone ? "#4CAF82" : "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                      {Math.round(editPct * 100)}%
                    </div>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${editPct * 100}%`,
                        background: renderDone
                          ? "linear-gradient(90deg, #4CAF82, #2ecc71)"
                          : "linear-gradient(90deg, #a78bfa, #c4b5fd)",
                        borderRadius: 999,
                        transition: "width 1s linear, background 0.4s",
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
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
                        : `${Math.round(capturePct * 100)}% · ${fmtTime(renderRemaining)} restantes`}
                  </div>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${capturePct * 100}%`,
                      background: renderDone
                        ? "linear-gradient(90deg, #4CAF82, #2ecc71)"
                        : "linear-gradient(90deg, #FF6B35, #ff9966)",
                      borderRadius: 999,
                      transition: "width 1s linear, background 0.4s",
                    }}
                  />
                </div>
              </div>
            )}
            {/* Sub-line: anúncios assistidos */}
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.35)", display: "flex", justifyContent: "space-between" }}>
              <span>📺 {adsWatched}/2 anúncios assistidos {adDone && "✓"}</span>
              {!adDone && <span>{totalAdRemaining}s pro botão liberar</span>}
            </div>
          </div>

          {/* Round 4d field follow-up (Mathieu 03/05): banner DEGRADED.
              Antes do fix, quando Remotion falhava o reel saía via concat
              fallback (widescreen sem música/edição/orientação custom) sem
              user saber. Backend agora seta session.degraded=true + reason.
              UI mostra warning honesto + caminho pro suporte ver log. */}
          {localRenderMode && localStatus?.degraded && (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                background: "rgba(255,107,53,0.08)",
                border: "1px solid rgba(255,107,53,0.4)",
                borderRadius: 8,
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.55,
              }}
            >
              <div style={{ fontWeight: 700, color: "#FF6B35", marginBottom: 6, fontSize: 13 }}>
                ⚠️ Reel saiu em modo degradado
              </div>
              <div style={{ marginBottom: 6 }}>
                A edição do Remotion (música, orientação vertical, cropping de
                HUD, transições) não rodou. O vídeo abaixo é o capture cru do
                CS2 — playable mas sem o polish.
              </div>
              {localStatus.degraded_reason && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "monospace", marginBottom: 6 }}>
                  Motivo: {localStatus.degraded_reason}
                </div>
              )}
              {localStatus.degraded_log_path && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  Log completo: <span style={{ fontFamily: "monospace" }}>{localStatus.degraded_log_path}</span>
                  <br />
                  (envie pra suporte se quiser que a gente investigue)
                </div>
              )}
            </div>
          )}

          {/* Bottom row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
              FragReel é 100% gratuito · sustentado por anúncios
            </div>

            {/* Botão SEMPRE presente — não-clicável até estar pronto.
                User pediu: "o botão de gerar fragreel tem que estar no ad o tempo
                todo, mas não como clicável, ajude o usuário a entender o processo."
                Local-render flow: nada pra baixar (já tá no Desktop) → vira
                "Abrir FragReel" que invoca /render/open no client (abre o vídeo
                no app default do Windows). Cliente velho: degrada pra
                copy-path no chip embaixo. */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {localRenderMode ? (
                <>
                  <button
                    onClick={canDownload && localOutputPath && !opening ? handleOpenOutput : undefined}
                    disabled={!canDownload || !localOutputPath || opening}
                    title={
                      canDownload
                        ? "Abrir o vídeo no seu reprodutor padrão"
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
                      cursor: canDownload && localOutputPath && !opening ? "pointer" : "not-allowed",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      transition: "background 0.3s",
                    }}
                  >
                    {opening ? "Abrindo…" : "▶ Abrir FragReel"}
                  </button>
                  {canDownload && (
                    <button
                      onClick={() => { setClosing(true); setTimeout(onClose, 300); }}
                      className="btn-secondary"
                      style={{ fontSize: 13, padding: "10px 18px" }}
                    >
                      Fechar
                    </button>
                  )}
                </>
              ) : (
                <>
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
                </>
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
          {/* Local-render: chip com o caminho do arquivo (fallback caso o
              "Abrir FragReel" falhe + atalho pra quem quer arrastar pra
              outro app). Só aparece pós-conclusão pra não poluir a UI
              durante o render. */}
          {localRenderMode && canDownload && localOutputPath && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {openError && (
                <div style={{ fontSize: 12, color: "#ffb088" }}>
                  ⚠️ {openError}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code
                  title={localOutputPath}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.65)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    userSelect: "all",
                  }}
                >
                  {localOutputPath}
                </code>
                <button
                  onClick={copyOutputPath}
                  style={{
                    fontSize: 11,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "rgba(255,255,255,0.65)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {pathCopied ? "✓ copiado" : "copiar"}
                </button>
              </div>
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
