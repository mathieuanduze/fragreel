"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMatches, type MatchSummary } from "@/lib/api";

export default function MatchList() {
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getMatches()
      .then(setMatches)
      .catch(() => { setError(true); setMatches([]); });
  }, []);

  // Loading
  if (matches === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="card"
            style={{ height: 80, opacity: 0.3, background: "#1A1A2E", borderRadius: 12 }}
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (matches.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 32px",
          background: "#16213E",
          border: "1px solid #2D2D44",
          borderRadius: 16,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
          {error ? "API offline" : "Nenhuma partida encontrada"}
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", maxWidth: 400, margin: "0 auto 24px" }}>
          {error
            ? "Não foi possível conectar à API. Tente novamente em instantes."
            : "Instale o client FragReel no Windows, jogue uma partida e a demo aparecerá aqui automaticamente."}
        </p>
        {!error && (
          <a
            href="https://github.com/mathieuanduze/fragreel/releases/download/latest-build/FragReel.exe"
            className="btn-primary"
            style={{ textDecoration: "none" }}
          >
            ↓ Baixar Client · Windows (.exe)
          </a>
        )}
      </div>
    );
  }

  // Match list
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {matches.map((m) => (
        <div
          key={m.id}
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto auto auto",
            alignItems: "center",
            gap: 20,
            padding: "16px 20px",
            opacity: m.status === "processing" ? 0.7 : 1,
          }}
        >
          <img
            src={`/maps/${m.map}.png`}
            alt={m.map.replace("de_", "")}
            width={48}
            height={48}
            style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />

          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {m.map.replace("de_", "").charAt(0).toUpperCase() +
                m.map.replace("de_", "").slice(1)}
              <span style={{ marginLeft: 10, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {m.date}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              Top play:{" "}
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{m.top_play}</span>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                color:
                  Number(m.score.split("–")[0]) > Number(m.score.split("–")[1])
                    ? "#4CAF82"
                    : "#E05555",
              }}
            >
              {m.score}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>K/D: {m.kd}</div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{m.rating}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Rating</div>
          </div>

          <div>
            {m.status === "ready" || m.status === "parsed" ? (
              <Link
                href={`/match/${m.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: "#FF6B35",
                  color: "white",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                🎬 Ver highlights
              </Link>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: "#1A1A2E",
                  border: "1px solid #2D2D44",
                  color: "rgba(255,255,255,0.5)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                ⚙️ Processando...
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
