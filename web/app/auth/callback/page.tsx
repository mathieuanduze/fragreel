"use client";

/**
 * /auth/callback?token=…&steamid=…&name=…
 *
 * Railway API redirects here after Steam OpenID verification.
 * We store the JWT and redirect to the dashboard.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/session";

function AuthCallbackInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error === "cancelled") {
      setStatus("error");
      setTimeout(() => router.replace("/login"), 2000);
      return;
    }

    if (!token) {
      setStatus("error");
      setTimeout(() => router.replace("/login"), 2000);
      return;
    }

    setToken(token);
    router.replace("/matches");
  }, [searchParams, router]);

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
        gap: 16,
      }}
    >
      {status === "loading" ? (
        <>
          <div style={{ fontSize: 36 }}>⚙️</div>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>
            Verificando identidade Steam…
          </p>
        </>
      ) : (
        <>
          <div style={{ fontSize: 36 }}>❌</div>
          <p style={{ fontSize: 15, color: "rgba(255,107,53,0.8)" }}>
            Login cancelado. Redirecionando…
          </p>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#0D0D1A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 36 }}>⚙️</div>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
