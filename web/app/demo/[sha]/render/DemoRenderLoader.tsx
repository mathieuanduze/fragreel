"use client";

/**
 * Sprint #7 Phase 7.4 (05/05) — bridges /demo/[sha]/render → MatchClient.
 *
 * Lifecycle:
 *   1. Mount → POST /demos/<sha>/score com target_steamid → match_doc
 *   2. match_doc retornado (5-15s parse+score) → render MatchClient com
 *      targetSteamid + targetName overrides
 *   3. MatchClient cuida do resto (highlight selection, mood, toggles,
 *      AdModal, render trigger). Backend client recebe overrides via
 *      user_steamid64 + user_player_name no payload do /render.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import MatchClient from "@/app/match/[id]/MatchClient";
import { scoreDemoForPlayer } from "@/lib/local";
import type { MatchOut } from "@/lib/api";

interface Props {
  sha: string;
  targetSteamid: string;
  targetName: string;
}

export default function DemoRenderLoader({ sha, targetSteamid, targetName }: Props) {
  const [match, setMatch] = useState<MatchOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await scoreDemoForPlayer(sha, targetSteamid);
        if (cancelled) return;
        // Backend retorna match_doc com schema compatível com MatchOut.
        // Cast direto — mismatch em campos opcionais não quebra UI.
        setMatch(result as MatchOut);
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, [sha, targetSteamid]);

  if (phase === "loading") {
    return (
      <section style={{ paddingTop: 110, paddingBottom: 60, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div className="tag" style={{ marginBottom: 12, color: "#FF6B35" }}>
            Mapeando plays de impacto
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>
            Analisando a perspectiva de <span style={{ color: "#FF6B35" }}>{targetName}</span>
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 32, lineHeight: 1.6 }}>
            Lendo a demo + identificando clutches, defuses, multi-kills e plays cinematográficas.
            Demora 5-15 segundos.
          </p>

          {/* Loading spinner-bar visual */}
          <div style={{
            width: "100%",
            maxWidth: 400,
            margin: "0 auto",
            height: 4,
            borderRadius: 2,
            background: "#2D2D44",
            overflow: "hidden",
            position: "relative",
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent 0%, #FF6B35 50%, transparent 100%)",
              animation: "shimmer 1.5s linear infinite",
            }} />
          </div>
          <style jsx>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>

          <div style={{ marginTop: 48, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            Backend parseando .dem (~5s) + IA scorer ranqueando highlights (~2s)
          </div>
        </div>
      </section>
    );
  }

  if (phase === "error" || !match) {
    return (
      <section style={{ paddingTop: 110, paddingBottom: 60, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            Não consegui mapear as plays
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 8, lineHeight: 1.5 }}>
            Algo deu errado parseando a demo ou consultando o scorer.
          </p>
          {error && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginBottom: 24, padding: "10px 14px", background: "#1A1A2E", borderRadius: 8, maxWidth: 480, margin: "0 auto 24px" }}>
              {error}
            </p>
          )}
          <Link href={`/demo/${sha}`} className="btn-secondary" style={{ padding: "10px 22px", fontSize: 13, textDecoration: "none" }}>
            ← Voltar
          </Link>
        </div>
      </section>
    );
  }

  // Phase "ready" — passa match_doc + overrides pro MatchClient existente.
  // MatchClient renderiza highlights, mood selector, 5 toggles, AdModal,
  // render trigger — tudo igual fluxo /match/[id] (Sprint #6 features incluídas).
  return (
    <MatchClient
      match={match}
      targetSteamid={targetSteamid}
      targetName={targetName}
    />
  );
}
