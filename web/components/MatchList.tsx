"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMatches, type MatchSummary } from "@/lib/api";

// "de_dust2" -> "Dust 2"
function prettyMap(raw: string): string {
  const cleaned = raw.replace(/^de_/, "").replace(/^cs_/, "");
  const special: Record<string, string> = {
    dust2: "Dust 2",
    office: "Office",
  };
  if (special[cleaned]) return special[cleaned];
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Tenta normalizar a string de placar "13–8" / "13-8" / "0-0"
function parseScore(raw: string): { ct: number; t: number; valid: boolean } {
  if (!raw) return { ct: 0, t: 0, valid: false };
  const m = raw.match(/(\d+)[\s\-–]+(\d+)/);
  if (!m) return { ct: 0, t: 0, valid: false };
  const ct = Number(m[1]);
  const t = Number(m[2]);
  return { ct, t, valid: ct + t > 0 };
}

// Match type baseado nos rounds (alinhado com LibraryContent)
function matchType(scoreCt: number, scoreT: number): { label: string; color: string } {
  const total = scoreCt + scoreT;
  if (total === 0) return { label: "Em análise", color: "rgba(255,255,255,0.4)" };
  if (Math.max(scoreCt, scoreT) >= 13) return { label: "Premier / Competitivo", color: "#FF6B35" };
  if (total >= 13 && total <= 16) return { label: "Wingman", color: "#a78bfa" };
  if (total < 8) return { label: "Demo curta", color: "rgba(255,255,255,0.5)" };
  return { label: "Casual / Outro", color: "rgba(255,255,255,0.5)" };
}

export default function MatchList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setMatches(null);
    setError(false);
    getMatches()
      .then(setMatches)
      .catch(() => { setError(true); setMatches([]); });
  }, [refreshKey]);

  if (matches === null) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ height: 220, opacity: 0.25, background: "#13131f", borderRadius: 12, border: "1px solid #2D2D44" }}
          />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 32px",
          background: "#13131f",
          border: "1px dashed #2D2D44",
          borderRadius: 16,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{error ? "⚠️" : "🎮"}</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
          {error ? "API offline" : "Nenhum FragReel ainda"}
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", maxWidth: 420, margin: "0 auto 20px" }}>
          {error
            ? "Não foi possível conectar à API. Tente novamente em instantes."
            : "Quando você gerar seu primeiro FragReel a partir de uma demo, ele aparece aqui."}
        </p>
        {!error && (
          <Link
            href="/library"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", background: "#FF6B35", color: "white",
              borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}
          >
            📂 Ir pra Minhas Demos
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
      {matches.map((m) => {
        const { ct, t, valid } = parseScore(m.score);
        const type = matchType(ct, t);
        const totalRounds = ct + t;
        const mapPretty = prettyMap(m.map);
        const mapImg = `/maps/${m.map}.png`;
        const isReady = m.status === "ready" || m.status === "parsed";

        return (
          <div key={m.id} style={{
            background: "#13131f",
            border: "1px solid #2D2D44",
            borderRadius: 12,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            transition: "border-color 0.15s",
          }}>
            {/* Header c/ thumb */}
            <div style={{
              position: "relative",
              height: 96,
              background: "linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)",
              overflow: "hidden",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapImg}
                alt={mapPretty}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", opacity: 0.4,
                }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, rgba(19,19,31,0.2) 0%, rgba(19,19,31,0.95) 100%)",
              }} />
              <div style={{
                position: "absolute", top: 10, left: 12, right: 12,
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: type.color,
                  padding: "3px 8px",
                  background: "rgba(0,0,0,0.55)",
                  border: `1px solid ${type.color}33`,
                  borderRadius: 5,
                }}>{type.label}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{m.date}</span>
              </div>
              <div style={{
                position: "absolute", bottom: 10, left: 14,
                fontWeight: 800, fontSize: 20, color: "#E8E8F0",
                letterSpacing: "-0.02em",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}>{mapPretty}</div>
            </div>

            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
              }}>
                <div title="Placar final" style={{
                  padding: "8px 10px", background: "#0d0d1a",
                  border: "1px solid #2D2D44", borderRadius: 8,
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                    Placar
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: valid ? "#E8E8F0" : "rgba(255,255,255,0.3)" }}>
                    {valid ? `${ct}–${t}` : "—"}
                  </div>
                </div>

                <div title="Kills / Deaths" style={{
                  padding: "8px 10px", background: "#0d0d1a",
                  border: "1px solid #2D2D44", borderRadius: 8,
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                    K / D
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E8E8F0" }}>
                    {m.kd || "—"}
                  </div>
                </div>

                <div title="Highlights detectados" style={{
                  padding: "8px 10px", background: "#0d0d1a",
                  border: "1px solid #2D2D44", borderRadius: 8,
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                    Highlights
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#FF6B35" }}>
                    {m.highlights_count ?? 0}
                  </div>
                </div>
              </div>

              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 11, color: "rgba(255,255,255,0.35)",
                paddingTop: 2,
              }}>
                <span title="Top play da partida">⭐ {m.top_play || "—"}</span>
                {totalRounds > 0 && <span>{totalRounds} rounds</span>}
              </div>

              {isReady ? (
                <Link
                  href={`/match/${m.id}`}
                  className="btn-primary"
                  style={{ fontSize: 13, padding: "10px 18px", marginTop: 2, textAlign: "center", textDecoration: "none" }}
                >
                  🎬 Ver FragReel
                </Link>
              ) : (
                <div
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 18px",
                    background: "#1A1A2E",
                    border: "1px solid #2D2D44",
                    color: "rgba(255,255,255,0.5)",
                    borderRadius: 8,
                    fontSize: 13, fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  ⚙️ Processando...
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
