"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getLocalDemos,
  pingLocalClient,
  triggerLocalUpload,
  LocalClientOffline,
  LocalDemo,
} from "@/lib/local";
import AnalyzeModal from "./AnalyzeModal";

function fmtDate(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtRelative(epoch: number): string {
  const diffMs = Date.now() - epoch * 1000;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  if (days < 30) return `há ${Math.floor(days / 7)}sem`;
  return fmtDate(epoch);
}

// "de_dust2" -> "Dust 2", "de_mirage" -> "Mirage"
function prettyMap(raw: string): string {
  const cleaned = raw.replace(/^de_/, "");
  const special: Record<string, string> = {
    dust2: "Dust 2",
    cs_office: "Office",
  };
  if (special[cleaned]) return special[cleaned];
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Heurística pra inferir tipo da partida pelo total de rounds.
// Premier/Competitive MR12: até 24 rounds (13-x). Wingman MR8: até 16. Outros: casual/DM.
function matchType(scoreCt: number, scoreT: number): { label: string; color: string } {
  const total = scoreCt + scoreT;
  if (total === 0) return { label: "Em análise", color: "rgba(255,255,255,0.4)" };
  if (Math.max(scoreCt, scoreT) >= 13) return { label: "Premier / Competitivo", color: "#FF6B35" };
  if (total >= 13 && total <= 16) return { label: "Wingman", color: "#a78bfa" };
  if (total < 8) return { label: "Demo curta", color: "rgba(255,255,255,0.5)" };
  return { label: "Casual / Outro", color: "rgba(255,255,255,0.5)" };
}

function fmtKD(k: number, d: number): string {
  if (d === 0) return k > 0 ? `${k.toFixed(1)}` : "—";
  return (k / d).toFixed(2);
}

export default function LibraryContent() {
  const router = useRouter();
  const [demos, setDemos] = useState<LocalDemo[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAnalyze, setActiveAnalyze] = useState<{ sha: string; mapName: string } | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setOffline(false);
    setError(null);
    try {
      const r = await getLocalDemos(refresh);
      setDemos(r.matches);
      setScanning(r.scanning);
      setScanDone(r.scan_done);
      if (r.error) setError(r.error);
    } catch (e) {
      if (e instanceof LocalClientOffline) setOffline(true);
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  // Enquanto o scan tá rolando no client, o /demos já retorna imediatamente
  // com scanning=true. Polling leve a cada 2.5s atualiza a UI quando o
  // bg-thread terminar — sem disparar novo scan (refresh=false).
  // Importante: NÃO depender de scan_done aqui — quando o user clica "Re-escanear"
  // após um scan já feito, o servidor responde {scanning:true, scan_done:true}
  // (scan anterior estava done, novo começou). Se condicionasse a !scanDone, o
  // botão ficaria preso em "Escaneando…" pra sempre.
  useEffect(() => {
    if (!scanning || offline) return;
    let alive = true;
    const id = setInterval(async () => {
      if (!alive) return;
      try {
        const r = await getLocalDemos(false);
        if (!alive) return;
        setDemos(r.matches);
        setScanning(r.scanning);
        setScanDone(r.scan_done);
        if (r.error) setError(r.error);
      } catch (e) {
        if (e instanceof LocalClientOffline) {
          setOffline(true);
          setScanning(false);
        }
      }
    }, 2500);
    return () => { alive = false; clearInterval(id); };
  }, [scanning, offline]);

  // Se a página renderizou em estado offline (user abriu /library antes de
  // ligar o .exe), pinga /health a cada 4s e dispara load() automaticamente
  // assim que o client aparecer — sem precisar clicar em "Recarregar".
  useEffect(() => {
    if (!offline) return;
    let alive = true;
    const id = setInterval(async () => {
      const ok = await pingLocalClient();
      if (alive && ok) {
        clearInterval(id);
        load(false);
      }
    }, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [offline, load]);

  const onPick = async (demo: LocalDemo) => {
    try {
      await triggerLocalUpload(demo.sha1);
      setActiveAnalyze({ sha: demo.sha1, mapName: demo.map_name });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (offline) {
    return (
      <div style={{ padding: 40, textAlign: "center", border: "1px solid #2D2D44", borderRadius: 12, background: "#13131f" }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>🖥️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>FragReel client não detectado</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", maxWidth: 460, margin: "0 auto 20px" }}>
          Pra ver suas partidas, instale e abra o FragReel no seu PC. Ele lê suas demos do CS2 localmente — nada é enviado sem sua confirmação.
        </div>
        <a href="/download" className="btn-primary" style={{ fontSize: 14, padding: "10px 22px", textDecoration: "none" }}>
          ⬇ Baixar client
        </a>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => load(false)} className="btn-secondary" style={{ fontSize: 13, padding: "8px 18px" }}>
            Já está aberto · Recarregar
          </button>
        </div>
      </div>
    );
  }

  // Antes do primeiro snapshot — só uma mensagem neutra.
  if (loading && !demos) {
    return <div style={{ padding: 40, color: "rgba(255,255,255,0.55)" }}>Conectando ao client…</div>;
  }

  if (error && !demos?.length) {
    return (
      <div style={{ padding: 24, color: "#ff8866", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 12 }}>
        Erro no scan: {error}
      </div>
    );
  }

  const busy = loading || scanning;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          {scanning && !scanDone
            ? "Escaneando suas demos no PC… (pode levar alguns minutos na 1ª vez)"
            : `${demos?.length ?? 0} partidas detectadas no seu PC`}
        </div>
        <button
          onClick={() => load(true)}
          disabled={busy}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "9px 18px",
            borderRadius: 8,
            background: "rgba(255,107,53,0.12)",
            color: "#FF6B35",
            border: "1px solid rgba(255,107,53,0.45)",
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,107,53,0.20)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,107,53,0.12)"; }}
        >
          <span style={{ fontSize: 14 }}>↻</span>
          {busy ? "Escaneando..." : "Re-escanear demos"}
        </button>
      </div>

      {error && demos && demos.length > 0 && (
        <div style={{ padding: 12, marginBottom: 12, fontSize: 13, color: "#ffb088", border: "1px solid rgba(255,150,80,0.35)", borderRadius: 8, background: "rgba(255,150,80,0.06)" }}>
          Aviso do client: {error}
        </div>
      )}

      {/* Sem demos + scan terminado = realmente vazio. Sem demos + scan rolando = placeholder de progresso. */}
      {(!demos || demos.length === 0) && (
        scanDone ? (
          <div style={{ padding: 28, textAlign: "center", color: "rgba(255,255,255,0.5)", border: "1px dashed #2D2D44", borderRadius: 12 }}>
            Nenhuma demo encontrada. Jogue uma partida competitiva ou baixe uma demo do HLTV pra começar.
          </div>
        ) : (
          <div style={{ padding: 28, textAlign: "center", color: "rgba(255,255,255,0.5)", border: "1px dashed #2D2D44", borderRadius: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            Lendo .dem do CS2… isso roda só localmente, nada é enviado.
          </div>
        )
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {(demos || []).map((d) => {
          const type = matchType(d.score_ct, d.score_t);
          const totalRounds = d.score_ct + d.score_t;
          const kd = fmtKD(d.player_kills, d.player_deaths);
          const mapPretty = prettyMap(d.map_name);
          // Tentativa de usar imagem do mapa; fallback pra gradiente se não existir.
          const mapImg = `/maps/${d.map_name}.png`;

          return (
            <div key={d.sha1} style={{
              background: "#13131f",
              border: "1px solid #2D2D44",
              borderRadius: 12,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              transition: "border-color 0.15s, transform 0.15s",
            }}>
              {/* Header com thumb do mapa */}
              <div style={{
                position: "relative",
                height: 96,
                background: `linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)`,
                overflow: "hidden",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapImg}
                  alt={mapPretty}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    opacity: 0.4,
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
                  <span
                    title={new Date(d.mtime * 1000).toLocaleString("pt-BR")}
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}
                  >
                    {fmtRelative(d.mtime)}
                  </span>
                </div>
                <div style={{
                  position: "absolute", bottom: 10, left: 14,
                  fontWeight: 800, fontSize: 20, color: "#E8E8F0",
                  letterSpacing: "-0.02em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}>{mapPretty}</div>
              </div>

              {/* Stats grid */}
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                }}>
                  {/* Placar */}
                  <div
                    title="Placar final do seu time (CT–TR)"
                    style={{
                      padding: "8px 10px",
                      background: "#0d0d1a",
                      border: "1px solid #2D2D44",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                      Placar
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: totalRounds > 0 ? "#E8E8F0" : "rgba(255,255,255,0.3)" }}>
                      {totalRounds > 0 ? `${d.score_ct}–${d.score_t}` : "—"}
                    </div>
                  </div>

                  {/* K/D kills/mortes */}
                  <div
                    title={`${d.player_kills} kills em ${d.player_deaths} mortes`}
                    style={{
                      padding: "8px 10px",
                      background: "#0d0d1a",
                      border: "1px solid #2D2D44",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                      K / D
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#E8E8F0" }}>
                      {d.player_kills}<span style={{ color: "rgba(255,255,255,0.3)" }}> / </span>{d.player_deaths}
                    </div>
                  </div>

                  {/* Ratio */}
                  <div
                    title="Proporção kills por morte — acima de 1.0 = positivo"
                    style={{
                      padding: "8px 10px",
                      background: "#0d0d1a",
                      border: "1px solid #2D2D44",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                      Ratio
                    </div>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: d.player_kills > d.player_deaths ? "#5be38f" : d.player_kills < d.player_deaths ? "#ff7066" : "#E8E8F0",
                    }}>
                      {kd}
                    </div>
                  </div>
                </div>

                {/* Metadados do arquivo */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: "rgba(255,255,255,0.35)",
                  paddingTop: 2,
                }}>
                  <span title="Tamanho do arquivo .dem">
                    📦 {d.size_mb} MB
                  </span>
                  <span title={`Rounds jogados nessa partida: ${totalRounds}`}>
                    {totalRounds} rounds
                  </span>
                  <span title="Identificador local da demo (SHA1 do arquivo)">
                    #{d.sha1.slice(0, 6)}
                  </span>
                </div>

                <button
                  onClick={() => onPick(d)}
                  className="btn-primary"
                  style={{ fontSize: 13, padding: "10px 18px", marginTop: 2 }}
                >
                  🎬 Gerar FragReel
                </button>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.4 }}>
                  A IA vai detectar ACEs, clutches e multi-kills · ~30s
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeAnalyze && (
        <AnalyzeModal
          sha={activeAnalyze.sha}
          mapName={activeAnalyze.mapName}
          onClose={() => setActiveAnalyze(null)}
          onReady={(matchId) => {
            setActiveAnalyze(null);
            router.push(`/match/${matchId}`);
          }}
        />
      )}
    </div>
  );
}
