import Link from "next/link";

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0D0D1A",
        color: "#E8E8F0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: 48 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: "#FF6B35", letterSpacing: "-0.02em" }}>
          FRAG<span style={{ color: "#E8E8F0" }}>REEL</span>
        </span>
      </Link>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#16213E",
          border: "1px solid #2D2D44",
          borderRadius: 20,
          padding: "40px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "rgba(255,107,53,0.1)",
            border: "1px solid rgba(255,107,53,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            marginBottom: 8,
          }}
        >
          🎮
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4, textAlign: "center" }}>
          Entrar no FragReel
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
          Use sua conta Steam para entrar.<br />Sem senha, sem cadastro.
        </p>

        {/* Steam button */}
        <Link
          href="/dashboard"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "14px 24px",
            background: "#1b2838",
            border: "1px solid #2a475e",
            borderRadius: 10,
            color: "white",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 15,
            transition: "background 0.2s",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#1b2838"/>
            <path
              d="M16 4C9.373 4 4 9.373 4 16c0 5.52 3.537 10.24 8.527 11.947l3.09-6.77a3.6 3.6 0 0 1-.617-.177 3.556 3.556 0 0 1-2.15-4.55l.002-.005-5.24-2.165A8.997 8.997 0 0 1 16 7a9 9 0 0 1 9 9 9 9 0 0 1-9 9c-.23 0-.46-.01-.686-.028l-2.56 5.607A12 12 0 1 0 16 4z"
              fill="#c6d4df"
            />
            <circle cx="20.5" cy="13.5" r="3.5" fill="#c6d4df"/>
          </svg>
          Entrar com Steam
        </Link>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: 1,
            background: "#2D2D44",
            margin: "20px 0",
          }}
        />

        {/* Trust signals */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          {[
            { icon: "🔒", text: "Nunca pedimos sua senha do Steam" },
            { icon: "👁️", text: "Acesso apenas ao seu SteamID público" },
            { icon: "🎮", text: "Detectamos suas demos automaticamente" },
          ].map((item) => (
            <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 32, fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
        FragReel · 2026 · Não afiliado à Valve Corporation
      </p>
    </div>
  );
}
