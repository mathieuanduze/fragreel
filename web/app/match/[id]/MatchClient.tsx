"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { MatchOut, Mood, generateVideo, getMatch, renderDownloadUrl } from "@/lib/api";
import AdSlot from "@/components/AdSlot";
import AdModal from "@/components/AdModal";

// Cada formato tem um teto diferente de cenas porque:
//   • reel (9:16, ~20s): timeline curta — 5 cenas é o sweet spot, mais começa a parecer rápido demais
//   • card (estático): não usa cenas, é um layout de stats — força 0
//   • recap (16:9, 2-3min): timeline longa, cabe mais narrativa — até 10
// O custo de render também escala com cenas (cada cena = re-encode + transição), então
// teto duro evita o usuário cobrar 5 minutos de render num reel de 20s.
const SCENE_CAPS: Record<string, number> = {
  reel: 5,
  card: 0,
  recap: 10,
};

const FORMATS = [
  { id: "reel",  icon: "🎬", label: "Highlights Reel",  format: "9:16 vertical · ~20s",       desc: "Intro com player/mapa, rank badges, kill feed animado por frag e stats no outro. Música sincronizada com os cortes.", dest: "TikTok · Reels · WhatsApp Status", maxScenes: SCENE_CAPS.reel },
  { id: "card",  icon: "🖼️", label: "Story Card",       format: "9:16 imagem estática",       desc: "Card com nick, mapa, K/D, HS%, ADR, rating e top play. Perfeito para stories.",         dest: "Instagram Stories · WhatsApp", maxScenes: SCENE_CAPS.card },
  { id: "recap", icon: "📺", label: "Recap Completo",   format: "16:9 horizontal · em breve", desc: "Narrativa da partida: frags, clutches, estatísticas sobrepostas e placar round a round.",    dest: "YouTube · Discord · Twitter", maxScenes: SCENE_CAPS.recap },
];

// Mapeamento de arma/tipo de kill pra ícone visual. A IA já manda `weapon` e
// `headshot` por kill — a gente desambigua aqui pra UI ficar legível de relance.
function killIcon(weapon: string, headshot: boolean): string {
  const w = weapon.toLowerCase();
  if (w.includes("knife") || w === "bayonet" || w.includes("karambit")) return "🔪";
  if (w.includes("awp") || w.includes("scar20") || w.includes("g3sg1")) return "🎯";
  if (w === "hegrenade" || w.includes("grenade") || w.includes("he_")) return "💣";
  if (w.includes("inferno") || w.includes("molotov") || w.includes("incendiary")) return "🔥";
  if (w.includes("taser") || w === "zeus") return "⚡";
  if (w === "deagle" || w.includes("revolver")) return "🔫";
  if (headshot) return "💥";
  return "🔫";
}

// Cor do badge da kill — destaca knife/awp/HS sobre kills "normais"
function killBadgeStyle(weapon: string, headshot: boolean): { bg: string; border: string; color: string } {
  const w = weapon.toLowerCase();
  if (w.includes("knife") || w === "bayonet" || w.includes("karambit")) {
    return { bg: "rgba(255,107,53,0.14)", border: "rgba(255,107,53,0.45)", color: "#FF6B35" };
  }
  if (w.includes("awp")) {
    return { bg: "rgba(167,139,250,0.14)", border: "rgba(167,139,250,0.45)", color: "#a78bfa" };
  }
  if (headshot) {
    return { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.40)", color: "#fbbf24" };
  }
  return { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" };
}

const MOODS: { id: Mood; icon: string; label: string; desc: string; color: string }[] = [
  { id: "acao",       icon: "⚡", label: "Ação",       desc: "128 BPM · heavy bass",    color: "#FF6B35" },
  { id: "eletronica", icon: "🎧", label: "Eletrônica", desc: "140 BPM · dnb / dubstep", color: "#a78bfa" },
  { id: "heroico",    icon: "🦸", label: "Heroico",    desc: "120 BPM · orchestral",    color: "#fbbf24" },
  { id: "chill",      icon: "😎", label: "Chill",      desc: "90 BPM · lo-fi",          color: "#4CAF82" },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${Number(s) < 10 ? "0" : ""}${s}`;
}

export default function MatchClient({ match: initialMatch }: { match: MatchOut }) {
  const [match, setMatch] = useState(initialMatch);
  const [format, setFormat] = useState("reel");
  // Pré-seleção: respeita o cap do formato inicial (reel = 5)
  const [selected, setSelected] = useState<Set<number>>(
    new Set(initialMatch.highlights.slice(0, Math.min(SCENE_CAPS.reel, 3)).map((h) => h.rank))
  );
  const [mood, setMood] = useState<Mood>("acao");
  const [generating, setGenerating] = useState(false);
  const [jobMsg, setJobMsg] = useState<string | null>(null);
  const [showAd, setShowAd] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [renderDuration, setRenderDuration] = useState(90);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isQueued = match.highlights.length === 0;

  // When queued: tick elapsed counter + poll for highlights every 15s
  useEffect(() => {
    if (!isQueued) return;

    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        // Every 15s, refetch the match
        if (next % 15 === 0) {
          getMatch(match.id).then((fresh) => {
            if (fresh.highlights.length > 0) {
              setMatch(fresh);
              setSelected(new Set(fresh.highlights.slice(0, 3).map((h) => h.rank)));
            }
          }).catch(() => {});
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isQueued, match.id]);

  // Cap dinâmico: muda quando user troca de formato. Pra card (cap=0) não usa cenas.
  const maxScenes = SCENE_CAPS[format] ?? 5;

  function toggle(rank: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) {
        next.delete(rank);
      } else {
        // Bloqueia se já bateu o cap — usuário precisa desmarcar uma antes
        if (maxScenes > 0 && next.size >= maxScenes) return prev;
        next.add(rank);
      }
      return next;
    });
  }

  // Quando muda o formato, se a seleção atual ultrapassa o novo cap, trunca
  // mantendo as primeiras (que estão ordenadas por rank — as melhores ficam).
  useEffect(() => {
    if (maxScenes === 0) {
      // Card: ignora seleção, não usa cenas
      return;
    }
    setSelected((prev) => {
      if (prev.size <= maxScenes) return prev;
      const sortedRanks = Array.from(prev).sort((a, b) => a - b).slice(0, maxScenes);
      return new Set(sortedRanks);
    });
  }, [format, maxScenes]);

  async function handleStartGenerate() {
    if (selected.size === 0 || generating) return;
    setGenerating(true);
    setJobMsg(null);
    setDownloadUrl(null);
    try {
      const res = await generateVideo(match.id, format, Array.from(selected), mood);
      setRenderDuration(res.estimated_seconds ?? 90);
      setJobMsg(res.message);
      setDownloadUrl(renderDownloadUrl(match.id, format));
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
          downloadUrl={downloadUrl}
          matchId={match.id}
          format={format}
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
            {maxScenes > 0 ? (
              <div style={{ color: "#FF6B35", fontWeight: 600, marginTop: 2 }}>
                {selectedCount}/{maxScenes} cena{maxScenes !== 1 ? "s" : ""} selecionada{selectedCount !== 1 ? "s" : ""}
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                Story Card é estático · não usa cenas
              </div>
            )}
          </div>
        </div>

        {/* Highlights */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Selecione os highlights</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>A IA já escolheu os melhores. Você pode ajustar antes de gerar.</p>

          {isQueued && (
            <div style={{ padding: "40px 32px", background: "#16213E", border: "1px solid #2D2D44", borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Analisando seus frags...</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", maxWidth: 380, margin: "0 auto 20px" }}>
                A IA está processando a demo. Esta página atualiza sozinha quando os highlights ficarem prontos.
              </p>

              {/* Progress bar animada */}
              <div style={{ height: 4, background: "#2D2D44", borderRadius: 99, maxWidth: 320, margin: "0 auto 16px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: "60%",
                  background: "linear-gradient(90deg, #FF6B35, #a78bfa)",
                  borderRadius: 99,
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
              </div>

              {/* Counter */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                <span>
                  ⏱ {elapsed < 60
                    ? `${elapsed}s`
                    : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
                </span>
                <span>·</span>
                <span>próxima verificação em {15 - (elapsed % 15)}s</span>
              </div>
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

                  {/* Preview thumbnail — vídeo real se disponível, placeholder caso contrário */}
                  <div style={{ width: 142, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, position: "relative", background: "linear-gradient(135deg,#131325,#0D0D1A)", border: on ? "1px solid rgba(255,107,53,0.3)" : "1px solid #2D2D44" }}>
                    {h.clip_url ? (
                      <video
                        src={h.clip_url}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                        onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                    ) : (
                      <>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 3px)" }} />
                        <div style={{ position: "absolute", top: 6, left: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>{match.map.replace("de_","")}</div>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, paddingLeft: 2, color: "rgba(255,255,255,0.3)" }}>▶</div>
                        </div>
                        <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>sem client</div>
                      </>
                    )}
                    <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 10, fontWeight: 600, color: "white", fontFamily: "monospace", background: "rgba(0,0,0,0.6)", padding: "1px 5px", borderRadius: 3 }}>{Math.round(h.end - h.start)}s</div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {h.label}
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", background: "#FF6B3515", padding: "2px 8px", borderRadius: 4 }}>{h.score} pts</span>
                      <span
                        title="Total de kills nesse highlight"
                        style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        💀 {h.kills.length}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {h.kills.map((k, i) => {
                        const icon = killIcon(k.weapon, k.headshot);
                        const s = killBadgeStyle(k.weapon, k.headshot);
                        return (
                          <span
                            key={i}
                            title={`${k.weapon}${k.headshot ? " · headshot" : ""} · vítima a ${k.hp} HP`}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: 5,
                              background: s.bg,
                              border: `1px solid ${s.border}`,
                              color: s.color,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              lineHeight: 1.4,
                            }}
                          >
                            <span style={{ fontSize: 12 }}>{icon}</span>
                            {k.label}
                          </span>
                        );
                      })}
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
          {maxScenes > 0 && selectedCount === 0 && (
            <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,107,53,0.7)", textAlign: "center" }}>
              Selecione pelo menos 1 highlight para continuar.
            </div>
          )}
          {maxScenes > 0 && selectedCount >= maxScenes && (
            <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
              Limite de {maxScenes} cenas para o formato {formatLabel} · desmarque uma para escolher outra
            </div>
          )}
        </div>

        {/* Ad — entre highlights e seletor de formato */}
        <div style={{ marginBottom: 32 }}>
          <AdSlot id="match-rectangle" size="banner" label="Patrocinado · Razer · Gear up for victory" />
        </div>

        {/* Format selector */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Escolha o formato</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>1 formato por geração. Cada formato tem um teto de cenas. Quer outro formato? Assiste mais 2 anúncios.</p>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "6px 10px", background: "#0D0D1A", borderRadius: 6 }}>{f.dest}</div>
                    <div
                      title={f.maxScenes === 0 ? "Story Card é estático, não usa cenas" : `Até ${f.maxScenes} cenas — mais cenas = mais tempo de render`}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        color: f.maxScenes === 0 ? "rgba(255,255,255,0.4)" : "rgba(255,107,53,0.85)",
                        padding: "4px 10px",
                        background: f.maxScenes === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,107,53,0.08)",
                        border: `1px solid ${f.maxScenes === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,107,53,0.25)"}`,
                        borderRadius: 6,
                        display: "inline-flex", alignItems: "center", gap: 5,
                        alignSelf: "flex-start",
                      }}
                    >
                      {f.maxScenes === 0 ? "📌 Sem cenas (estático)" : `🎞 Até ${f.maxScenes} cenas`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mood selector — formatos que carregam música (reel + recap).
             Card é só estatística, sem trilha. */}
        {(format === "reel" || format === "recap") && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Escolha a trilha</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
              {format === "recap"
                ? "A trilha rola por baixo da narração e se adapta ao ritmo dos rounds."
                : "A música sincroniza com os cortes do vídeo. Todas royalty-free."}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {MOODS.map((m) => {
                const active = mood === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: active ? `2px solid ${m.color}` : "1px solid #2D2D44",
                      background: active ? `${m.color}12` : "#16213E",
                      cursor: "pointer",
                      textAlign: "left",
                      position: "relative",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    {active && (
                      <div style={{ position: "absolute", top: 10, right: 10, width: 16, height: 16, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "white" }}>✓</div>
                    )}
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: active ? m.color : "#E8E8F0", marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
              {maxScenes === 0 ? (
                <><b style={{ color: "rgba(255,255,255,0.7)" }}>Story Card</b> usa só estatísticas da partida · <b style={{ color: "rgba(255,255,255,0.7)" }}>2 anúncios de 30s</b>. <span style={{ color: "rgba(255,255,255,0.3)" }}>Sem assinatura.</span></>
              ) : selectedCount > 0 ? (
                <><b style={{ color: "rgba(255,255,255,0.7)" }}>{selectedCount} cena{selectedCount !== 1 ? "s" : ""}</b> · formato <b style={{ color: "rgba(255,255,255,0.7)" }}>{formatLabel}</b> · <b style={{ color: "rgba(255,255,255,0.7)" }}>2 anúncios de 30s</b> durante o render. <span style={{ color: "rgba(255,255,255,0.3)" }}>Sem assinatura.</span></>
              ) : (
                <span style={{ color: "rgba(255,107,53,0.7)" }}>Selecione pelo menos 1 highlight acima.</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            {maxScenes > 0 && (
              <button
                className="btn-ghost"
                style={{ fontSize: 13 }}
                onClick={() => {
                  setSelected(new Set(match.highlights.slice(0, Math.min(maxScenes, 3)).map((h) => h.rank)));
                  setJobMsg(null);
                }}
              >
                Resetar seleção
              </button>
            )}
            <button
              className="btn-primary"
              style={{
                fontSize: 14, padding: "10px 24px",
                opacity: (maxScenes > 0 && selectedCount === 0) || generating ? 0.4 : 1,
                cursor: (maxScenes > 0 && selectedCount === 0) || generating ? "not-allowed" : "pointer",
              }}
              disabled={(maxScenes > 0 && selectedCount === 0) || generating}
              onClick={handleStartGenerate}
            >
              {generating ? "⏳ Gerando..." : "▶ Assistir anúncios e gerar"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
