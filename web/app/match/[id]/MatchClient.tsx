"use client";

import { useState } from "react";
import Link from "next/link";
import { MatchOut, generateVideo } from "@/lib/api";
import AdSlot from "@/components/AdSlot";
import AdModal from "@/components/AdModal";

const FORMATS = [
  { id: "reel",  icon: "🎬", label: "Highlights Reel",  format: "9:16 vertical · ~47s",      desc: "2 câmeras por frag: POV do atirador + vítima em câmera lenta. Música e cortes automáticos.", dest: "TikTok · Reels · WhatsApp Status" },
  { id: "recap", icon: "📺", label: "Recap Completo",   format: "16:9 horizontal · ~2m34s",   desc: "Narrativa da partida: frags, clutches, estatísticas sobrepostas e placar round a round.",    dest: "YouTube · Discord · Twitter" },
  { id: "card",  icon: "🖼️", label: "Story Card",       format: "9:16 imagem estática",       desc: "Card com nick, mapa, K/D, rating e top play. Gerado em segundos, sem renderização.",         dest: "Instagram Stories · WhatsApp" },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${Number(s) < 10 ? "0" : ""}${s}`;
}

export default function MatchClient({ match }: { match: MatchOut }) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(match.highlights.slice(0, 3).map((h) => h.rank))
  );
  const [format, setFormat] = useState("reel");
  const [generating, setGenerating] = useState(false);
  const [jobMsg, setJobMsg] = useState<string | null>(null);
  const [showAd, setShowAd] = useState(false);
  const [renderDuration, setRenderDuration] = useState(90);

  function toggle(rank: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(rank) ? next.delete(rank) : next.add(rank);
      return next;
    });
  }

  async function handleStartGenerate() {
    if (selected.size === 0 || generating) return;
    setGenerating(true);
    setJobMsg(null);
    try {
      const res = await generateVideo(match.id, format, Array.from(selected));
      setRenderDuration(res.estimated_seconds ?? 90);
      setJobMsg(res.message);
      setShowAd(true);
    } catch {
      setJobMsg("Erro ao iniciar geração. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  const selectedCount = selected.size;
  const formatLabel = FORMATS.find((f) => f.id === format)?.label ?? "vídeo";

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      {showAd && (
        <AdModal
          formatLabel={formatLabel}
          renderDuration={renderDuration}
          onClose={() => setShowAd(false)}
        />
      )}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 60px" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 28, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          <Link href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Minhas Partidas</Link>
          {" / "}
          <span style={{ color: "rgba(255,255,255,0.7)" }}>{match.map} · {match.date}</span>
        </div>

        {/* Match header */}
        <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, marginBottom: 40, padding: "24px 28px" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
              {match.map.replace("de_", "").charAt(0).toUpperCase() + match.map.replace("de_", "").slice(1)}
              <span style={{ marginLeft: 12, fontSize: 18, color: "#4CAF82", fontWeight: 700 }}>{match.score}</span>
            </h1>
            <div style={{ display: "flex", gap: 24, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
              <span>K/D: <b style={{ color: "#E8E8F0" }}>{match.stats.kd}</b></span>
              <span>HS: <b style={{ color: "#E8E8F0" }}>{match.stats.hs}</b></span>
              <span>ADR: <b style={{ color: "#E8E8F0" }}>{match.stats.adr}</b></span>
              <span>Rating: <b style={{ color: "#FF6B35" }}>{match.stats.rating}</b></span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "right" }}>
            <div>{match.highlights.length} highlights detectados</div>
            <div style={{ color: "#FF6B35", fontWeight: 600, marginTop: 2 }}>{selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Highlights */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Selecione os highlights</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>A IA já escolheu os melhores. Você pode ajustar antes de gerar.</p>

          {match.highlights.length === 0 && (
            <div style={{ padding: "40px 32px", background: "#16213E", border: "1px solid #2D2D44", borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Demo em processamento</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", maxWidth: 380, margin: "0 auto" }}>
                A IA ainda está analisando seus frags. Volte em alguns instantes — a página atualiza sozinha.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {match.highlights.map((h) => {
              const on = selected.has(h.rank);
              return (
                <div key={h.rank} className="card" style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto", gap: 16, alignItems: "center", padding: "12px 20px", borderColor: on ? "rgba(255,107,53,0.2)" : undefined, opacity: on ? 1 : 0.5, transition: "opacity 0.15s" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, background: h.rank === 1 ? "#FF6B35" : "#2D2D44", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    #{h.rank}
                  </div>

                  {/* Preview thumbnail */}
                  <div style={{ width: 142, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, position: "relative", background: h.rank === 1 ? "linear-gradient(135deg,#2A1A10,#1A1020)" : "linear-gradient(135deg,#131325,#0D0D1A)", border: on ? "1px solid rgba(255,107,53,0.15)" : "1px solid #2D2D44" }}>
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 3px)" }} />
                    <div style={{ position: "absolute", top: 6, left: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>{match.map.replace("de_","")}</div>
                    <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", background: "rgba(0,0,0,0.4)", padding: "1px 5px", borderRadius: 3 }}>{Math.round(h.end - h.start)}s</div>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: on ? "rgba(255,107,53,0.85)" : "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, paddingLeft: 2 }}>▶</div>
                    </div>
                    <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>preview</div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                      {h.label}
                      <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: "#FF6B35", background: "#FF6B3515", padding: "2px 8px", borderRadius: 4 }}>{h.score} pts</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {h.kills.map((k, i) => <span key={i} className="badge" style={{ fontSize: 11 }}>{k.label}</span>)}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{fmt(h.start)} — {fmt(h.end)}</span>
                    <button onClick={() => toggle(h.rank)} style={{ width: 44, height: 24, borderRadius: 12, background: on ? "#FF6B35" : "#2D2D44", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedCount === 0 && <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,107,53,0.7)", textAlign: "center" }}>Selecione pelo menos 1 highlight para continuar.</div>}
        </div>

        {/* Ad — entre highlights e seletor de formato */}
        <div style={{ marginBottom: 32 }}>
          <AdSlot id="match-rectangle" size="banner" label="Patrocinado · Razer · Gear up for victory" />
        </div>

        {/* Format selector */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Escolha o formato</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>1 formato por geração. Quer outro formato? Assiste mais 1 anúncio.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {FORMATS.map((f) => {
              const active = format === f.id;
              return (
                <button key={f.id} onClick={() => setFormat(f.id)} style={{ padding: "20px", borderRadius: 12, border: active ? "2px solid #FF6B35" : "1px solid #2D2D44", background: active ? "rgba(255,107,53,0.06)" : "#16213E", cursor: "pointer", position: "relative", textAlign: "left", transition: "border-color 0.15s,background 0.15s" }}>
                  {active && <div style={{ position: "absolute", top: 12, right: 12, width: 20, height: 20, borderRadius: "50%", background: "#FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white" }}>✓</div>}
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, color: "#E8E8F0" }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: "#FF6B35", fontWeight: 600, marginBottom: 8 }}>{f.format}</div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginBottom: 12 }}>{f.desc}</p>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "6px 10px", background: "#0D0D1A", borderRadius: 6 }}>{f.dest}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Job result */}
        {jobMsg && (
          <div style={{ marginBottom: 16, padding: "14px 20px", background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.25)", borderRadius: 10, fontSize: 14, color: "#FF6B35" }}>
            {jobMsg}
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: "24px 28px", background: "#16213E", border: "1px solid #2D2D44", borderRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Pronto para gerar?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
              {selectedCount > 0 ? (
                <><b style={{ color: "rgba(255,255,255,0.7)" }}>{selectedCount} highlight{selectedCount !== 1 ? "s" : ""}</b> · formato <b style={{ color: "rgba(255,255,255,0.7)" }}>{formatLabel}</b> · <b style={{ color: "rgba(255,255,255,0.7)" }}>1 anúncio de ~30s</b>. <span style={{ color: "rgba(255,255,255,0.3)" }}>Sem assinatura.</span></>
              ) : (
                <span style={{ color: "rgba(255,107,53,0.7)" }}>Selecione pelo menos 1 highlight acima.</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => { setSelected(new Set(match.highlights.slice(0,3).map(h=>h.rank))); setJobMsg(null); }}>Resetar seleção</button>
            <button className="btn-primary" style={{ fontSize: 14, padding: "10px 24px", opacity: selectedCount === 0 || generating ? 0.4 : 1, cursor: selectedCount === 0 || generating ? "not-allowed" : "pointer" }} disabled={selectedCount === 0 || generating} onClick={handleStartGenerate}>
              {generating ? "⏳ Gerando..." : "▶ Assistir anúncio e gerar"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
