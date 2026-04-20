"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();
  const isLoggedIn = path === "/dashboard" || path.startsWith("/match");

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
                href="/dashboard"
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: path === "/dashboard" ? "#FF6B35" : "rgba(255,255,255,0.6)",
                  textDecoration: "none",
                }}
              >
                Minhas Partidas
              </Link>
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
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#2D2D44",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  👤
                </div>
                <span style={{ fontWeight: 500 }}>Player123</span>
              </div>
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
                Baixar Client
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
