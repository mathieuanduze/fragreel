"use client";

/**
 * HeroCTA — botões da hero section da LP.
 *
 * Sprint DEMO-3 v4 fix (08/05/2026 Mathieu spec):
 * "Na LP, quando o user está já logado, ele não tem botão pra entrar
 * na plataforma. precisa deslogar e logar de novo".
 *
 * Logged-out: Baixar client + "ou entrar com Steam"
 * Logged-in: Baixar client + "Ir pra Minhas Demos →"
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import DownloadButton from "@/components/DownloadButton";
import { getUser, type SessionUser } from "@/lib/session";

export default function HeroCTA({ versionSuffix }: { versionSuffix: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
    const onFocus = () => setUser(getUser());
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        justifyContent: "center",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <DownloadButton
        className="btn-primary"
        style={{
          fontSize: 18,
          fontWeight: 700,
          padding: "18px 38px",
          boxShadow: "0 8px 32px rgba(255,107,53,0.45), 0 0 0 1px rgba(255,107,53,0.3)",
          transform: "scale(1)",
          transition: "transform 0.15s",
        }}
      >
        ⬇ Baixar grátis pro Windows{versionSuffix}
      </DownloadButton>

      {/* Sprint v5.6.2 (Mathieu spec): "Ir pra Minhas Demos" só aparecia
          em duplicidade (Nav top-right + aqui no hero). Mathieu specou
          "tem que estar em cima à direita, junto com o login" — aquele
          é o canonical. HeroCTA pra logged-in vira link textual sutil
          "(já tá logado · ir pra plataforma)" pra não duplicar visual. */}
      {hydrated && user ? null : (
        <Link
          href="/login"
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.55)",
            textDecoration: "underline",
            textDecorationColor: "rgba(255,255,255,0.2)",
            textUnderlineOffset: 4,
            fontWeight: 500,
          }}
        >
          ou entrar com Steam
        </Link>
      )}
    </div>
  );
}
