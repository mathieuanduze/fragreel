"use client";

import { useEffect, useState } from "react";
import { useLatestClientVersion } from "@/lib/useLatestClientVersion";
import { triggerClientUpdate, pingLocalClient, getLocalClientVersion } from "@/lib/local";
import { isOutdated } from "@/lib/version-compare";

type Props = {
  /** Versão que o usuário tem rodando agora (ou null se desconhecida). */
  localVersion: string | null;
  onClose: () => void;
};

/** Estados internos do flow de auto-update.
 *
 *  idle      — user vê os 2 botões (auto / manual) e a explicação.
 *  updating  — "Atualizar automaticamente" disparou; client está baixando
 *              o novo .exe (download leva 10-30s tipicamente).
 *  swapping  — backend respondeu OK; helper .bat foi spawnado e o processo
 *              vai morrer em ~2s. Estamos esperando a versão nova voltar
 *              online via polling em /version.
 *  failed    — alguma etapa falhou (download, 501 no client antigo, etc).
 *              Cai pro CTA manual sem perder o estado da modal.
 */
type UpdateState = "idle" | "updating" | "swapping" | "failed";

/**
 * Modal bloqueante que aparece quando o usuário tenta gerar um FragReel
 * com client antigo. v0.2.11 ganhou o botão "Atualizar automaticamente"
 * que invoca `/update` no client local — sem mais "feche o exe na bandeja
 * + abra o novo" pra usuários comuns.
 *
 * Cliente velho (<= v0.2.10) não tem o endpoint /update; cai pro path
 * manual automaticamente quando o backend responde 501.
 *
 * Não é dismissível por click fora — ou atualiza ou fecha o X.
 */
export default function UpdateRequiredModal({ localVersion, onClose }: Props) {
  const [state, setState] = useState<UpdateState>("idle");
  const [error, setError] = useState<string | null>(null);
  // Detalhes pra mostrar progresso real ("baixou 32.4 MB", etc).
  const [downloadInfo, setDownloadInfo] = useState<{ size_mb: number } | null>(null);
  // Última release publicada no GitHub (antes vinha hardcoded em lib/version.ts).
  // Pode ser null em loading / erro de API — todos os callsites abaixo têm fallback.
  const { latest } = useLatestClientVersion();

  const handleAutoUpdate = async () => {
    setState("updating");
    setError(null);
    try {
      const r = await triggerClientUpdate();
      setDownloadInfo({ size_mb: r.size_mb });
      // Backend OK — agora é esperar o helper trocar o .exe e o client
      // novo voltar online. Poll loop abaixo cuida disso.
      setState("swapping");
    } catch (e) {
      const err = e as Error & { code?: string };
      // 501 = client velho sem /update. Avisa de forma específica pra que
      // o user entenda por que o auto não rolou (em vez de só "erro").
      if (err.code === "not_supported" || err.code === "not_frozen") {
        setError(
          "Este client é antigo demais pra atualizar sozinho. Baixe o novo .exe abaixo e abra manualmente.",
        );
      } else {
        setError(err.message || "Falha ao atualizar automaticamente.");
      }
      setState("failed");
    }
  };

  // Polling no estado "swapping" — quando o client volta online com a
  // versão nova, fecha o modal automaticamente. Poll a cada 2s; sai do
  // loop ao detectar versão atual ou se o user fechar.
  useEffect(() => {
    if (state !== "swapping") return;
    let alive = true;
    const id = setInterval(async () => {
      if (!alive) return;
      const online = await pingLocalClient();
      if (!online) return; // ainda reiniciando
      const v = await getLocalClientVersion();
      if (!alive) return;
      // Check "atualizado" tem 2 caminhos:
      //   - Se sabemos qual é a latest (GitHub API OK): compara via isOutdated
      //   - Se latest === null (GitHub indisponível): proxy = versão reportada
      //     mudou em relação à localVersion que o user tinha no mount. Menos
      //     preciso, mas garante que o flow não trava por causa de rate limit.
      const targetOK = latest
        ? !isOutdated(v || "", latest)
        : !!v && v !== localVersion;
      if (v && targetOK) {
        clearInterval(id);
        // Pequeno delay pra que o usuário veja "✓ atualizado" antes de
        // o modal sumir (UX — fecha sem feedback parece bug).
        setTimeout(() => { if (alive) onClose(); }, 1200);
      }
    }, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [state, onClose, latest, localVersion]);

  const isBusy = state === "updating" || state === "swapping";

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
        {/* X só aparece quando NÃO estamos no meio do auto-update — fechar
            no meio do swap deixa o sistema num estado meio quebrado (helper
            .bat ainda vai trocar o .exe, user precisaria reabrir manualmente). */}
        {!isBusy && (
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
        )}

        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>
          {state === "swapping" ? "🔄" : state === "updating" ? "⬇️" : "⚠️"}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "white", margin: 0, textAlign: "center" }}>
          {state === "swapping" ? "Reiniciando o FragReel…"
            : state === "updating" ? "Baixando o novo client…"
            : "Atualize o FragReel"}
        </h2>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 12, marginBottom: 24, lineHeight: 1.5 }}>
          {state === "swapping" ? (
            <>
              {downloadInfo && <>Baixou {downloadInfo.size_mb} MB · </>}
              Trocando o .exe e reabrindo. Isso fecha automaticamente
              quando a nova versão voltar online (~5-15s).
            </>
          ) : state === "updating" ? (
            <>Conectando ao GitHub e baixando o .exe novo. Pode levar 10-30s
            dependendo da sua conexão.</>
          ) : (
            <>
              Você está com uma versão antiga do client.
              <br />
              Versões antigas geram arquivos que podem não tocar em players comuns
              (ex: Windows Media Player) e perdem correções recentes da câmera + edição.
            </>
          )}
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFC107", marginTop: 2 }}>
              {latest ?? "última versão"}
            </div>
          </div>
        </div>

        {/* CTA primário: auto-update (preferred). Some quando o backend já
            confirmou que não suporta (state=failed && code=not_supported,
            mostra só o manual abaixo). */}
        {state !== "failed" && (
          <button
            onClick={handleAutoUpdate}
            disabled={isBusy}
            style={{
              display: "block",
              width: "100%",
              background: isBusy
                ? "rgba(255,107,53,0.4)"
                : "linear-gradient(135deg, #FF6B35, #FF8E53)",
              color: "white",
              padding: "14px 24px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              textAlign: "center",
              border: "none",
              cursor: isBusy ? "wait" : "pointer",
              boxShadow: isBusy ? "none" : "0 4px 14px rgba(255,107,53,0.35)",
              marginBottom: 10,
              opacity: isBusy ? 0.85 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {state === "swapping"
              ? "🔄 Aguardando o client voltar…"
              : state === "updating"
                ? "⬇ Baixando…"
                : "✨ Atualizar automaticamente"}
          </button>
        )}

        {/* Fallback manual — sempre disponível. Em "idle" funciona como
            opt-out (user que prefere baixar/instalar à mão). Em "failed"
            vira o caminho principal. */}
        <a
          href="/download"
          download="FragReel.exe"
          onClick={() => {
            // Manual download não fecha o modal — user precisa fechar o
            // exe antigo + abrir o novo, e a UI ainda quer detectar isso
            // via polling automático do useClientVersionStatus.
          }}
          style={{
            display: "block",
            background: state === "failed"
              ? "linear-gradient(135deg, #FF6B35, #FF8E53)"
              : "transparent",
            color: state === "failed" ? "white" : "rgba(255,255,255,0.7)",
            padding: state === "failed" ? "14px 24px" : "10px 16px",
            borderRadius: 10,
            fontWeight: state === "failed" ? 700 : 600,
            fontSize: state === "failed" ? 15 : 13,
            textAlign: "center",
            textDecoration: "none",
            border: state === "failed" ? "none" : "1px solid rgba(255,255,255,0.18)",
            boxShadow: state === "failed" ? "0 4px 14px rgba(255,107,53,0.35)" : "none",
          }}
        >
          {state === "failed"
            ? `⬇ Baixar FragReel ${latest ?? ""} manualmente`.replace(/\s+/g, " ").trim()
            : "Prefiro baixar e instalar manualmente"}
        </a>

        {error && (
          <div style={{
            marginTop: 14,
            padding: "10px 12px",
            fontSize: 12,
            color: "#ffb088",
            background: "rgba(255,150,80,0.08)",
            border: "1px solid rgba(255,150,80,0.3)",
            borderRadius: 8,
          }}>
            <b>Não rolou:</b> {error}
          </div>
        )}

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 16, marginBottom: 0, lineHeight: 1.5 }}>
          {state === "idle" ? (
            <>O auto-update baixa o .exe novo e reinicia o client sozinho —
            sem precisar fechar nada à mão.</>
          ) : state === "swapping" ? (
            <>Não feche essa janela — vai sumir sozinha quando o client
            novo voltar.</>
          ) : state === "updating" ? (
            <>Aguarde o download terminar antes de fechar.</>
          ) : (
            <>Depois de baixar, feche o client antigo na bandeja do sistema
            e abra o novo `.exe`. A página detecta automaticamente.</>
          )}
        </p>
      </div>
    </div>
  );
}
