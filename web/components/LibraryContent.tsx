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

export default function LibraryContent() {
  const router = useRouter();
  const [demos, setDemos] = useState<LocalDemo[] | null>(null);
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
    } catch (e) {
      if (e instanceof LocalClientOffline) setOffline(true);
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

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

  if (loading && !demos) {
    return <div style={{ padding: 40, color: "rgba(255,255,255,0.55)" }}>Escaneando suas demos…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "#ff8866", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 12 }}>
        Erro: {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          {demos?.length ?? 0} partidas detectadas no seu PC
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "9px 18px",
            borderRadius: 8,
            background: "rgba(255,107,53,0.12)",
            color: "#FF6B35",
            border: "1px solid rgba(255,107,53,0.45)",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,107,53,0.20)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,107,53,0.12)"; }}
        >
          <span style={{ fontSize: 14 }}>↻</span>
          {loading ? "Escaneando..." : "Re-escanear demos"}
        </button>
      </div>

      {(!demos || demos.length === 0) && (
        <div style={{ padding: 28, textAlign: "center", color: "rgba(255,255,255,0.5)", border: "1px dashed #2D2D44", borderRadius: 12 }}>
          Nenhuma demo encontrada. Jogue uma partida competitiva ou baixe uma demo do HLTV pra começar.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {(demos || []).map((d) => (
          <div key={d.sha1} style={{
            padding: "18px 20px",
            background: "#13131f",
            border: "1px solid #2D2D44",
            borderRadius: 12,
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#E8E8F0" }}>{d.map_name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmtDate(d.mtime)}</div>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "flex", gap: 14 }}>
                <span>{d.player_kills}K / {d.player_deaths}D</span>
                {(d.score_ct + d.score_t) > 0 && <span>{d.score_ct}–{d.score_t}</span>}
                <span>{d.size_mb} MB</span>
              </div>
            </div>
            <button onClick={() => onPick(d)} className="btn-primary" style={{ fontSize: 13, padding: "9px 18px" }}>
              🎬 Gerar FragReel
            </button>
          </div>
        ))}
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
