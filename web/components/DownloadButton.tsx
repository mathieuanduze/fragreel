"use client";

/**
 * DownloadButton — Sprint Install Indicator (06/05).
 *
 * Wrapper de <a download="FragReel.exe"> que ALÉM de baixar, marca o
 * timestamp em localStorage pra Nav exibir banner "Instalando o client".
 *
 * Uso (substitui <a href="/download" download> espalhados):
 *   <DownloadButton className="btn-primary" style={...}>
 *     ⬇ Baixar grátis
 *   </DownloadButton>
 *
 * Mantém todos os atributos download/href padrão. Just adds onClick handler
 * pra markDownloadClicked() antes do browser disparar download.
 */
import { ReactNode, CSSProperties } from "react";
import { markDownloadClicked } from "@/lib/installState";

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
  return (
    <a
      href={href}
      download="FragReel.exe"
      className={className}
      style={{ textDecoration: "none", ...style }}
      onClick={() => {
        markDownloadClicked();
      }}
    >
      {children}
    </a>
  );
}
