"use client";

/**
 * SteamLoginModal — modal pra login Steam credentials dentro do client.
 *
 * Sprint DEMO-3 Sprint 3 (08/05/2026).
 *
 * Flow:
 *   1. User entra account_name + password
 *   2. Submit → POST 127.0.0.1:5775/api/steam/login
 *   3. Se Steam Guard required (428): mostra input pra two_factor_code OR auth_code (email)
 *   4. Resubmit com code
 *   5. Sucesso → close modal, refresh useSteamGCStatus
 *
 * Segurança:
 *   - Credentials NUNCA passam pelo nosso servidor
 *   - Request vai DIRETO pro client local (127.0.0.1:5775)
 *   - Client local faz login via lib node-steam-user (DoctorMcKay, open source)
 *   - refresh_token é encrypted via DPAPI Windows (steam_token_store.py)
 *   - Senha não é persistida — só refresh_token
 *
 * Mesma arquitetura que Faceit, Leetify, CSGOStats, cs-demo-manager usam.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "credentials" | "two_factor" | "submitting" | "success" | "error";

const ENDPOINT = "http://127.0.0.1:5775/api/steam/login";

export default function SteamLoginModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("credentials");
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const submit = async (params: Record<string, string>) => {
    setStep("submitting");
    setErrorMsg(null);

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 35_000);
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStep("success");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
        return;
      }

      // Map error codes
      const error = data.error || `http_${res.status}`;
      if (error === "two_factor_required") {
        setStep("two_factor");
        return;
      }
      if (error === "steam_guard_required") {
        setStep("two_factor");
        return;
      }
      if (error === "invalid_password") {
        setErrorMsg("Senha incorreta. Tenta de novo.");
        setStep("credentials");
        return;
      }
      if (error === "rate_limit_exceeded") {
        setErrorMsg("Steam tá te limitando. Espera ~10 min e tenta de novo.");
        setStep("error");
        return;
      }
      if (error === "no_saved_token") {
        // Sidecar disse pra usar saved mas não tem — comum em first run
        setStep("credentials");
        return;
      }
      setErrorMsg(`Erro: ${error}`);
      setStep("error");
    } catch (e) {
      const err = e as Error;
      setErrorMsg(
        err.name === "AbortError"
          ? "Timeout — Steam não respondeu em 35s. Verifica conexão."
          : `Falha de conexão: ${err.message}`,
      );
      setStep("error");
    }
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName || !password) {
      setErrorMsg("Preenche username e senha.");
      return;
    }
    submit({ account_name: accountName, password });
  };

  const handleTwoFactorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode) {
      setErrorMsg("Digita o código do Steam Guard.");
      return;
    }
    submit({
      account_name: accountName,
      password,
      two_factor_code: twoFactorCode.toUpperCase(),
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="steam-login-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={() => step === "submitting" ? null : onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #15151f 0%, #0d0d18 100%)",
          borderRadius: 16,
          maxWidth: 480,
          width: "100%",
          padding: "32px 36px",
          border: "1px solid rgba(255, 107, 53, 0.30)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,107,53,0.12)",
          position: "relative",
        }}
      >
        {/* Close X */}
        {step !== "submitting" && (
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              position: "absolute",
              top: 14,
              right: 16,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.45)",
              fontSize: 24,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}

        <h2
          id="steam-login-title"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#E8E8F0",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {step === "two_factor" ? "Steam Guard" : "Conectar suas matches CS2"}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.55)",
            margin: "6px 0 22px",
            lineHeight: 1.55,
          }}
        >
          {step === "credentials" &&
            "Login Steam (1x). Suas credenciais não saem do seu PC — vão direto pro FragReel local. Mesmo flow do Faceit/Leetify."}
          {step === "two_factor" &&
            "Steam Guard ativado. Coloca o código do app móvel ou email."}
          {step === "submitting" &&
            "Conectando ao Steam..."}
          {step === "success" &&
            "✅ Conectado! Carregando suas matches..."}
          {step === "error" &&
            "Algo deu errado."}
        </p>

        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit}>
            <Field
              label="Username Steam"
              type="text"
              value={accountName}
              onChange={setAccountName}
              autoFocus
            />
            <Field
              label="Senha Steam"
              type="password"
              value={password}
              onChange={setPassword}
              ref={passwordRef}
            />
            {errorMsg && <ErrorBanner msg={errorMsg} />}
            <PrimaryButton type="submit" label="Conectar" />
            <SecurityNote />
          </form>
        )}

        {step === "two_factor" && (
          <form onSubmit={handleTwoFactorSubmit}>
            <Field
              label="Código Steam Guard"
              type="text"
              value={twoFactorCode}
              onChange={setTwoFactorCode}
              placeholder="ABCDE"
              autoFocus
              maxLength={10}
              monospace
            />
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Abre o app Steam no celular → aba Steam Guard, ou checa email.
            </p>
            {errorMsg && <ErrorBanner msg={errorMsg} />}
            <PrimaryButton type="submit" label="Confirmar" />
          </form>
        )}

        {step === "submitting" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid rgba(255,107,53,0.20)",
                borderTopColor: "#FF6B35",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
          </div>
        )}

        {step === "error" && (
          <>
            {errorMsg && <ErrorBanner msg={errorMsg} />}
            <PrimaryButton onClick={() => setStep("credentials")} label="Tentar novamente" />
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoFocus,
  placeholder,
  maxLength,
  monospace,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  maxLength?: number;
  monospace?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 6,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        style={{
          width: "100%",
          padding: "10px 12px",
          background: "rgba(0,0,0,0.30)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 8,
          color: "rgba(255,255,255,0.95)",
          fontSize: 14,
          fontFamily: monospace ? "ui-monospace, monospace" : "inherit",
          outline: "none",
          letterSpacing: monospace ? "0.1em" : "normal",
        }}
      />
    </label>
  );
}

function PrimaryButton({
  label,
  onClick,
  type,
}: {
  label: string;
  onClick?: () => void;
  type?: "submit" | "button";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      style={{
        marginTop: 8,
        width: "100%",
        padding: "12px 20px",
        background: "linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%)",
        border: "none",
        borderRadius: 10,
        color: "white",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "0.01em",
        boxShadow: "0 4px 20px rgba(255, 107, 53, 0.30)",
      }}
    >
      {label}
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        marginBottom: 14,
        padding: "10px 14px",
        background: "rgba(255,107,53,0.10)",
        border: "1px solid rgba(255,107,53,0.30)",
        borderRadius: 8,
        fontSize: 12,
        color: "#FFB088",
        lineHeight: 1.5,
      }}
    >
      {msg}
    </div>
  );
}

function SecurityNote() {
  return (
    <p
      style={{
        marginTop: 14,
        fontSize: 11,
        color: "rgba(255,255,255,0.40)",
        lineHeight: 1.5,
      }}
    >
      🔒 Credenciais ficam no seu PC. FragReel não recebe nem armazena sua
      senha em nenhum servidor — login via libs Node oficial open source
      (mesmo padrão Faceit/Leetify).
    </p>
  );
}
