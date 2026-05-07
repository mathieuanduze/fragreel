"use client";

/**
 * SmartScreenWarningModal — Sprint Ship Unsigned (07/05/2026).
 *
 * Pós-rejeição SignPath, FragReel ship sem assinatura digital. Esse
 * modal aparece UMA ÚNICA VEZ pro user no primeiro click do botão
 * "Baixar grátis" — educa sobre o flow do Windows SmartScreen pra que
 * o user não desista achando que é vírus.
 *
 * Conteúdo:
 *   1. Confirmação "download iniciado" (não bloqueia o download — ele
 *      acontece em paralelo via <a download>)
 *   2. 2 mockups visuais simulando as telas do SmartScreen com os
 *      botões destacados ("Mais informações" → "Executar mesmo assim")
 *   3. Bloco de tranquilização — "fase beta, signing oficial em breve"
 *   4. FAQ accordion "Por que o Windows mostra esse aviso?"
 *   5. CTA "Entendi, ver progresso da instalação" → fecha modal
 *
 * Trigger: DownloadButton chama setShow(true) APÓS markDownloadClicked().
 * Persistência (round 2 — 07/05 noite): modal aparece SEMPRE por padrão.
 * Checkbox "Não mostrar novamente" seta opt-out via setSmartScreenOptOut(true).
 * Decisão posterior ao Mathieu reportar que flag implicit one-time tinha
 * mascarado info crítica em teste de campo (modal nunca apareceu pq alguma
 * sessão anterior tinha "fechado" sem expor o user à info).
 *
 * Decisão design: NÃO usa screenshots reais do SmartScreen — usa mockups
 * SVG/HTML inline pra (a) não depender de assets externos, (b) sempre
 * carregar mesmo em conexão ruim, (c) ter aspecto consistente entre Win10/11.
 */
import { useEffect, useRef, useState } from "react";
import { setSmartScreenOptOut } from "@/lib/installState";

type Props = {
  onClose: () => void;
};

export default function SmartScreenWarningModal({ onClose }: Props) {
  const [faqOpen, setFaqOpen] = useState(false);
  const [optOut, setOptOut] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Round 3 fix (07/05 noite): Mathieu reportou modal abre scrollado direto
  // na "etapa 2", topo não visível. Causa provável: aria-modal="true" + role
  // dialog disparam auto-focus em alguns browsers, e o close X (position
  // absolute, fora do flow) força scrollIntoView no scrollable container.
  // Fix: força scrollTop = 0 no mount + após próximo frame (cobre layout
  // shift assíncrono pós-fadeIn).
  useEffect(() => {
    const reset = () => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    };
    reset();
    const raf = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = () => {
    if (optOut) setSmartScreenOptOut(true);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smartscreen-title"
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
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={handleClose}
    >
      <div
        ref={scrollRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        autoFocus
        style={{
          background: "linear-gradient(180deg, #15151f 0%, #0d0d18 100%)",
          borderRadius: 16,
          maxWidth: 620,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "0",
          border: "1px solid rgba(255, 107, 53, 0.35)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,107,53,0.15)",
          position: "relative",
          outline: "none",
        }}
      >
        {/* Header STICKY — confirmação download. Round 4 fix (07/05 noite):
            Mathieu reportou modal abria com scroll na "etapa 2" mesmo após
            useEffect scrollTop=0. Solução: header com position sticky no topo
            do scroll container — mesmo se algo dispara scrollIntoView, o
            header permanece visível. */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "linear-gradient(180deg, #15151f 0%, #15151f 92%, rgba(21,21,31,0))",
            padding: "32px 36px 18px",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 8,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(91, 227, 143, 0.15)",
              border: "2px solid #5be38f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5be38f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h2
              id="smartscreen-title"
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#E8E8F0",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Seu download começou
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", lineHeight: 1.4 }}>
              FragReel.exe · ~120 MB · pasta Downloads
            </p>
          </div>
          {/* Close X — DENTRO do sticky header (não absolute) pra não disparar
              scrollIntoView. Visualmente mantém top-right via flex layout. */}
          <button
            onClick={handleClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.45)",
              fontSize: 26,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
              flexShrink: 0,
              alignSelf: "flex-start",
            }}
          >
            ×
          </button>
        </div>

        {/* Conteúdo scrollable com padding lateral */}
        <div style={{ padding: "0 36px 32px" }}>

        {/* Aviso "antes de abrir" */}
        <div
          style={{
            marginTop: 4,
            padding: "14px 16px",
            background: "rgba(255, 193, 7, 0.08)",
            border: "1px solid rgba(255, 193, 7, 0.3)",
            borderRadius: 10,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>⚠️</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>
            <strong style={{ color: "#FFC107" }}>Antes de abrir o .exe:</strong> o Windows
            vai mostrar um aviso azul de &quot;Windows protegeu seu PC&quot;. <strong>É normal</strong> —
            é só porque ainda não temos certificado digital. Veja como passar:
          </div>
        </div>

        {/* Step 1 — mockup SmartScreen */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={stepBadge}>1</span>
            <span style={stepLabel}>Clique em &quot;<strong>Mais informações</strong>&quot;</span>
          </div>
          <SmartScreenMockup highlight="more-info" />
        </div>

        {/* Step 2 — mockup com Run Anyway */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={stepBadge}>2</span>
            <span style={stepLabel}>Clique em &quot;<strong>Executar assim mesmo</strong>&quot;</span>
          </div>
          <SmartScreenMockup highlight="run-anyway" />
        </div>

        {/* Tranquilização beta */}
        <div
          style={{
            marginTop: 24,
            padding: "14px 16px",
            background: "rgba(255, 107, 53, 0.07)",
            border: "1px solid rgba(255, 107, 53, 0.25)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
            <strong style={{ color: "#FF8E53" }}>Estamos em fase beta.</strong> O FragReel está em processo
            de obter assinatura digital oficial — quando ela chegar, esse aviso some.
            Enquanto isso, todo o código roda local na sua máquina e nada estranho acontece.
            Você pode auditar o que o client faz a qualquer momento.
          </div>
        </div>

        {/* FAQ accordion */}
        <button
          onClick={() => setFaqOpen((v) => !v)}
          style={{
            marginTop: 18,
            width: "100%",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            fontWeight: 600,
            textAlign: "left",
          }}
          aria-expanded={faqOpen}
        >
          <span>Por que o Windows mostra esse aviso?</span>
          <span
            aria-hidden
            style={{
              transition: "transform 0.2s",
              transform: faqOpen ? "rotate(180deg)" : "rotate(0deg)",
              fontSize: 12,
            }}
          >
            ▼
          </span>
        </button>
        {faqOpen && (
          <div
            style={{
              padding: "14px 16px",
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.65,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              marginTop: -1,
            }}
          >
            O Windows usa um sistema chamado <strong>SmartScreen</strong> que bloqueia
            programas sem &quot;reputação&quot; ainda construída. Reputação é acumulada quando
            milhares de usuários baixam um programa assinado por uma autoridade
            certificadora reconhecida.
            <br /><br />
            Como o FragReel ainda está em beta e custa caro pra projetos pequenos
            obter o certificado de pronto (~USD 400-700/ano pra reputação imediata),
            optamos por shipar sem assinatura por enquanto e investir esse dinheiro em
            features. <strong>Isso não significa que o programa é perigoso</strong> — só
            significa que ainda não pagamos a &quot;taxa&quot; pra que o Windows confie por padrão.
            <br /><br />
            Programas conhecidos da comunidade Counter-Strike como <strong>HLAE</strong>,
            <strong> mirv_pgl</strong> e <strong>Counter-Strike Demo Manager</strong> seguem o mesmo
            caminho.
          </div>
        )}

        {/* Opt-out checkbox */}
        <label
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            userSelect: "none",
            padding: "8px 4px",
          }}
        >
          <input
            type="checkbox"
            checked={optOut}
            onChange={(e) => setOptOut(e.target.checked)}
            style={{
              width: 16,
              height: 16,
              accentColor: "#FF6B35",
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            Não mostrar novamente neste navegador
          </span>
        </label>

        {/* CTA */}
        <button
          onClick={handleClose}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "14px 20px",
            background: "linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%)",
            border: "none",
            borderRadius: 10,
            color: "white",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.01em",
            boxShadow: "0 4px 20px rgba(255, 107, 53, 0.35)",
          }}
        >
          Entendi, ver progresso da instalação
        </button>

        </div>{/* /padded content */}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const stepBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "#FF6B35",
  color: "white",
  fontSize: 13,
  fontWeight: 800,
  flexShrink: 0,
};

const stepLabel: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.85)",
  fontWeight: 500,
};

/**
 * Mockup visual do SmartScreen — replica visual da janela azul do
 * Windows com botão destacado conforme o step.
 *
 * Não é screenshot real — é HTML/CSS replicando a aparência. Vantagem:
 * sempre carrega, fica consistente em qualquer device, e o highlight do
 * botão correto é controlado via prop.
 */
function SmartScreenMockup({ highlight }: { highlight: "more-info" | "run-anyway" }) {
  return (
    <div
      style={{
        background: "#0078D4",
        borderRadius: 8,
        padding: 18,
        position: "relative",
        boxShadow: "0 4px 16px rgba(0, 120, 212, 0.25)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      {/* Header: shield icon + título */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="white" aria-hidden>
          <path d="M12 2 L4 5 V11 C4 16.5 7.5 21 12 22 C16.5 21 20 16.5 20 11 V5 Z" opacity="0.95" />
          <path d="M12 2 L4 5 V11 C4 16.5 7.5 21 12 22 C16.5 21 20 16.5 20 11 V5 Z M9.5 12 L11 13.5 L14.5 10" stroke="#0078D4" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ color: "white", fontSize: 14, fontWeight: 600 }}>
          O Windows protegeu seu computador
        </div>
      </div>

      {/* Texto principal */}
      <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>
        O Microsoft Defender SmartScreen impediu a inicialização de um aplicativo não reconhecido.
        A execução desse aplicativo pode colocar seu PC em risco.
      </div>

      {/* Link "Mais informações" — destacado se highlight=more-info */}
      {highlight === "more-info" ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <span
            style={{
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "underline",
              padding: "4px 8px",
              borderRadius: 4,
              background: "rgba(255, 193, 7, 0.35)",
              border: "2px solid #FFC107",
              boxShadow: "0 0 0 4px rgba(255, 193, 7, 0.18), 0 0 20px rgba(255, 193, 7, 0.4)",
              animation: "pulse-highlight 1.6s ease-in-out infinite",
            }}
          >
            Mais informações
          </span>
          <ArrowPointer />
        </div>
      ) : (
        <div style={{ color: "white", fontSize: 13, textDecoration: "underline", display: "inline-block", opacity: 0.55 }}>
          Mais informações
        </div>
      )}

      {/* Botões — só aparecem quando estamos no step "run-anyway" */}
      {highlight === "run-anyway" && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <button
              disabled
              style={{
                padding: "8px 18px",
                background: "white",
                color: "#0078D4",
                border: "2px solid #FFC107",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 700,
                cursor: "default",
                boxShadow: "0 0 0 4px rgba(255, 193, 7, 0.18), 0 0 20px rgba(255, 193, 7, 0.4)",
                animation: "pulse-highlight 1.6s ease-in-out infinite",
              }}
            >
              Executar assim mesmo
            </button>
            <ArrowPointer />
          </div>
          <button
            disabled
            style={{
              padding: "8px 18px",
              background: "transparent",
              color: "white",
              border: "1px solid white",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "default",
              opacity: 0.6,
            }}
          >
            Não executar
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse-highlight {
          0%, 100% { box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.18), 0 0 20px rgba(255, 193, 7, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(255, 193, 7, 0.28), 0 0 28px rgba(255, 193, 7, 0.55); }
        }
      `}</style>
    </div>
  );
}

/** Setinha amarela apontando pra BAIXO acima do elemento destacado.
 *
 * Round 2 fix (07/05 noite): seta horizontal posicionada à direita do
 * botão "Executar assim mesmo" parecia apontar pro botão VIZINHO ("Não
 * executar") porque eles estão lado-a-lado. Solução: seta vertical acima
 * apontando pra baixo — sem ambiguidade. */
function ArrowPointer() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        bottom: "100%",
        transform: "translateX(-50%)",
        marginBottom: 4,
        animation: "arrow-bounce-v 1.4s ease-in-out infinite",
        pointerEvents: "none",
      }}
    >
      <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
        <path
          d="M10 2 L10 22 M10 22 L4 16 M10 22 L16 16"
          stroke="#FFC107"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <style jsx global>{`
        @keyframes arrow-bounce-v {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
