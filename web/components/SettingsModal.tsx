"use client";

import { useEffect, useState } from "react";
import {
  getConfig,
  pickFolder,
  resetConfig,
  setConfig as saveConfig,
  type ResolvedConfig,
} from "@/lib/local-config";
import { LocalClientOffline } from "@/lib/local";

interface Props {
  onClose: () => void;
}

/**
 * Modal de configurações do client desktop. Hoje só expõe `output_dir`
 * mas a estrutura aguenta crescer (host_framerate, qualidade, etc).
 *
 * Aberto via botão de engrenagem na Nav. Fecha ao clicar fora ou no X.
 *
 * Mount/unmount strategy: o pai (Nav) renderiza condicionalmente — só
 * monta este componente quando o usuário abre o modal. Isso evita o
 * anti-pattern de resetar state sincronamente no useEffect (proibido em
 * React 19 / Next 16) e garante state fresco a cada abertura.
 */
export default function SettingsModal({ onClose }: Props) {
  const [config, setConfigState] = useState<ResolvedConfig | null>(null);
  const [pendingPath, setPendingPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  // Load once at mount. Cleanup só seta uma flag local — sem setState,
  // pra não disparar a regra react-hooks/set-state-in-effect.
  useEffect(() => {
    let alive = true;
    getConfig()
      .then((c) => {
        if (!alive) return;
        setConfigState(c);
        setPendingPath(c.output_dir);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof LocalClientOffline) {
          setError("FragReel client não está rodando. Abra o FragReel.exe e tente novamente.");
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function onPick() {
    setPicking(true);
    setError(null);
    try {
      const r = await pickFolder();
      if (!r.cancelled && r.path) {
        setPendingPath(r.path);
      }
    } catch (e: unknown) {
      // 501 = tkinter not bundled — user can still type the path manually.
      const code = (e as { code?: string }).code;
      if (code === "tkinter_unavailable") {
        setError("Picker nativo indisponível nesta build. Cole o caminho no campo abaixo.");
      } else if (e instanceof LocalClientOffline) {
        setError("FragReel client offline.");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setPicking(false);
    }
  }

  async function onSave() {
    if (!pendingPath.trim()) {
      setError("Caminho vazio.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedToast(false);
    try {
      const updated = await saveConfig(pendingPath.trim());
      setConfigState(updated);
      setPendingPath(updated.output_dir);
      setSavedToast(true);
      // Toast desaparece em 2.5s mas a UI já reflete o novo path
      // imediatamente via setConfigState acima.
      setTimeout(() => setSavedToast(false), 2500);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      const status = (e as { status?: number }).status;
      if (code === "not_writable") {
        setError("Não consigo escrever nessa pasta — sem permissão de escrita.");
      } else if (code === "cannot_create") {
        setError("Não consigo criar essa pasta. Verifique se o caminho é válido.");
      } else if (status === 400) {
        setError(e instanceof Error ? e.message : "Caminho inválido.");
      } else if (e instanceof LocalClientOffline) {
        setError("FragReel client offline.");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    setSaving(true);
    setError(null);
    try {
      const updated = await resetConfig();
      setConfigState(updated);
      setPendingPath(updated.output_dir);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const envOverride = config?.source === "env";
  const dirty =
    config !== null && pendingPath.trim() !== config.output_dir;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Configurações do FragReel client"
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#15152A",
          border: "1px solid #2D2D44",
          borderRadius: 12,
          padding: 24,
          color: "#E8E8F0",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Configurações
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {loading && (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Carregando configuração do client…
          </div>
        )}

        {!loading && (
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 6,
              }}
            >
              Pasta de saída dos FragReels
            </label>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.5,
              }}
            >
              Onde o vídeo final (.mov + .mp4) será salvo. Útil quando o disco
              do CS2 está cheio e você quer apontar pra outro drive.
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={pendingPath}
                onChange={(e) => setPendingPath(e.target.value)}
                disabled={envOverride || saving}
                placeholder={config?.default ?? ""}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  background: "#0D0D1A",
                  border: "1px solid #2D2D44",
                  borderRadius: 6,
                  color: "#E8E8F0",
                  fontSize: 13,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  outline: "none",
                }}
              />
              <button
                onClick={onPick}
                disabled={envOverride || picking || saving}
                style={{
                  padding: "9px 14px",
                  background: "#2D2D44",
                  border: "1px solid #2D2D44",
                  borderRadius: 6,
                  color: "#E8E8F0",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor:
                    envOverride || picking || saving ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: envOverride || picking || saving ? 0.55 : 1,
                }}
              >
                {picking ? "Abrindo…" : "Escolher pasta…"}
              </button>
            </div>

            {config && (
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 4,
                }}
              >
                {config.source === "default" && (
                  <>Usando a pasta padrão.</>
                )}
                {config.source === "config" && (
                  <>Pasta personalizada (salva em config.json).</>
                )}
                {config.source === "env" && (
                  <>
                    Sobrescrita por <code>FRAGREEL_OUTPUT_DIR</code>:{" "}
                    <code>{config.env_override}</code>
                  </>
                )}
              </div>
            )}

            {envOverride && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "rgba(255,107,53,0.08)",
                  border: "1px solid rgba(255,107,53,0.35)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.5,
                }}
              >
                A variável de ambiente <code>FRAGREEL_OUTPUT_DIR</code> está
                definida e tem prioridade sobre esta UI. Pra editar daqui,
                remova a env var e reinicie o FragReel.exe.
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                padding: "10px 12px",
                background: "rgba(91,158,227,0.08)",
                border: "1px solid rgba(91,158,227,0.25)",
                borderRadius: 6,
                fontSize: 11,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "rgba(255,255,255,0.85)" }}>
                Atenção:
              </strong>{" "}
              isto redireciona apenas o vídeo final. A captura intermediária
              (frames TGA, vários GB) continua no drive onde o CS2 está
              instalado.
            </div>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#fca5a5",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            {savedToast && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  background: "rgba(91,227,143,0.10)",
                  border: "1px solid rgba(91,227,143,0.35)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#5be38f",
                }}
              >
                ✓ Salvo. Próximo render vai usar essa pasta.
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 20,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={onReset}
                disabled={saving || envOverride || config?.source === "default"}
                style={{
                  padding: "9px 16px",
                  background: "transparent",
                  border: "1px solid #2D2D44",
                  borderRadius: 6,
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  cursor:
                    saving || envOverride || config?.source === "default"
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    saving || envOverride || config?.source === "default"
                      ? 0.4
                      : 1,
                }}
              >
                Resetar pro padrão
              </button>
              <button
                onClick={onSave}
                disabled={saving || envOverride || !dirty}
                style={{
                  padding: "9px 18px",
                  background: dirty && !envOverride ? "#FF6B35" : "#2D2D44",
                  border: "none",
                  borderRadius: 6,
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    saving || envOverride || !dirty ? "not-allowed" : "pointer",
                  opacity: saving || envOverride || !dirty ? 0.55 : 1,
                }}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
