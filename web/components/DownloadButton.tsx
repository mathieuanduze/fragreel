"use client";

/**
 * DownloadButton — Sprint Install Indicator (06/05) + SmartScreen modal (07/05).
 *
 * Wrapper de <a download="FragReel.exe"> que ALÉM de baixar:
 *   - marca timestamp em localStorage pra Nav exibir banner "Instalando o client"
 *   - abre SmartScreenWarningModal NA PRIMEIRA VEZ (educa user sobre o flow
 *     "Mais informações → Executar mesmo assim" do Win SmartScreen pós-decisão
 *     ship-unsigned 07/05)
 *
 * O download começa em paralelo via <a download> nativo. O modal NÃO bloqueia
 * o browser — quando o user fecha (X, click fora, ou CTA), o .exe já está na
 * pasta Downloads.
 *
 * Persistência: flag `fragreel:smartscreenWarningSeen` em localStorage. Se o
 * user já viu, o click direto comporta-se como antes (sem modal).
 *
 * Uso (substitui <a href="/download" download> espalhados):
 *   <DownloadButton className="btn-primary" style={...}>
 *     ⬇ Baixar grátis
 *   </DownloadButton>
 */
import { ReactNode, CSSProperties, useState } from "react";
import { markDownloadClicked, isSmartScreenOptedOut } from "@/lib/installState";
import SmartScreenWarningModal from "./SmartScreenWarningModal";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Override href; default = "/download" */
  href?: string;
};

export default function DownloadButton({
  children,
  className,
  style,
  href = "/download",
}: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <a
        href={href}
        download="FragReel.exe"
        className={className}
        style={{ textDecoration: "none", ...style }}
        onClick={() => {
          markDownloadClicked();
          // Modal aparece SEMPRE por padrão — opt-out explícito via
          // checkbox no modal (round 2 fix 07/05: flag stale escondia
          // info crítica em campo). Mathieu pode marcar "não mostrar
          // novamente" se preferir.
          if (!isSmartScreenOptedOut()) {
            setShowModal(true);
          }
        }}
      >
        {children}
      </a>

      {showModal && <SmartScreenWarningModal onClose={() => setShowModal(false)} />}
    </>
  );
}
