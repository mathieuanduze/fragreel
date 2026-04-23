"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, logout, type SessionUser } from "@/lib/session";
import ClientStatusChip from "./ClientStatusChip";
// Settings modal escondido em v0.2.7 — UX de "escolher pasta" estava
// confusa porque só redireciona o output FINAL (.mov/.mp4), não os TGAs
// intermediários (vários GB ainda capturam no drive do CS2). Vamos
// trazer de volta em v0.2.8 quando o junction-point automático estiver
// implementado e a UI puder honestamente prometer "tudo no drive escolhido".
// SettingsModal.tsx + lib/local-config.ts continuam no repo, prontos
// pra reativar trocando o import + render abaixo.
// import SettingsModal from "./SettingsModal";

export default function Nav() {
  const path      = usePathname();
  const router    = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // const [settingsOpen, setSettingsOpen] = useState(false);  // ver comentário no import

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);

    // Re-checa sessão ao focar a aba (pego a expiração do JWT sem precisar
    // navegar). Antes a Nav tratava "logado" só pelo path da rota — então
    // ao voltar pra "/" o user via "Entrar / Começar agora" mesmo com o
    // token válido no localStorage, dando a impressão de logout fantasma.
    const onFocus = () => setUser(getUser());
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, [path]);

  // Sessão real (token válido no localStorage), independente da rota.
  const isLoggedIn = hydrated && user !== null;

  const displayName = user?.name ?? "Player";
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "rgba(13,13,26,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #2D2D44",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#FF6B35", letterSpacing: "-0.02em" }}>
            FRAG<span style={{ color: "#E8E8F0" }}>REEL</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLoggedIn ? (
            <>
              <Link
                href="/library"
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: path === "/library" ? "#FF6B35" : "rgba(255,255,255,0.6)",
                  textDecoration: "none",
                }}
              >
                Minhas Demos
              </Link>
              <Link
                href="/dashboard"
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: path === "/dashboard" ? "#FF6B35" : "rgba(255,255,255,0.6)",
                  textDecoration: "none",
                }}
              >
                Meus FragReels
              </Link>

              {/* Client status (online/offline) */}
              <ClientStatusChip />

              {/* User chip */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  background: "#1A1A2E",
                  border: "1px solid #2D2D44",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {user?.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.avatar}
                    alt=""
                    width={24}
                    height={24}
                    style={{ borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#FF6B35",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {initials}
                  </div>
                )}
                <span style={{ fontWeight: 500 }}>{displayName}</span>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.3)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.6)",
                  textDecoration: "none",
                }}
              >
                Entrar
              </Link>
              <Link
                href="/login"
                style={{
                  padding: "8px 18px",
                  background: "#FF6B35",
                  color: "white",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Começar agora
              </Link>
            </>
          )}
        </div>
      </div>
      {/* {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )} */}
    </nav>
  );
}
