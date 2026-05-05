"use client";

/**
 * Sprint #5 Phase B — Pro Demo Render: lista demos locais (TODAS, não só
 * matchmaking history). Cada item mostra metadata básica + botão pra abrir
 * roster picker.
 *
 * Diferença vs Library /library: aqui mostramos demos SEM filtrar por
 * matched-to-Steam-history. Pro demos baixados de HLTV/CSGOStats.gg
 * aparecem aqui mesmo sem match_id.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getLocalDemosAwaitingScan,
  pingLocalClient,
  LocalClientOffline,
  type LocalDemosResponse,
} from "@/lib/local";

export default function ProDemoListClient() {
  const [demos, setDemos] = useState<LocalDemosResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientOnline, setClientOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await pingLocalClient();
        if (cancelled) return;
        setClientOnline(true);
        const resp = await getLocalDemosAwaitingScan();
        if (cancelled) return;
        setDemos(resp);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof LocalClientOffline) {
          setClientOnline(false);
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (clientOnline === false) {
    return (
      <div style={{ padding: 24, background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔌</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>FragReel client não está rodando</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginBottom: 16, maxWidth: 480, margin: "0 auto" }}>
          Pra listar demos do seu PC, precisamos do client local rodando.
          Se ainda não baixou, pega ele aqui:
        </p>
        <a href="/download" download="FragReel.exe" className="btn-primary" style={{ display: "inline-block", padding: "10px 24px", fontSize: 14, textDecoration: "none" }}>
          ⬇ Baixar client
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.3)", borderRadius: 8, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
        Erro listando demos: {error}
      </div>
    );
  }

  if (!demos) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Buscando demos no seu PC...
      </div>
    );
  }

  if (demos.matches.length === 0) {
    return (
      <div style={{ padding: 24, background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 12, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
        Nenhuma .dem encontrada em <code style={{ color: "#FF6B35" }}>csgo/replays/</code>.<br />
        Coloque uma demo lá e atualize a página.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {demos.matches.map((d) => {
        const sizeMB = d.size_mb ? d.size_mb.toFixed(1) : "?";
        const filename = d.demo_path.split(/[\\/]/).pop() || d.sha1;
        return (
          <div key={d.sha1} style={{
            padding: "14px 16px",
            background: "#1A1A2E",
            border: "1px solid #2D2D44",
            borderRadius: 10,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 12,
            alignItems: "center",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {filename}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{d.map_name?.replace(/^de_/, "").toUpperCase() || "?"}</span>
                <span>·</span>
                <span>{sizeMB} MB</span>
                <span>·</span>
                <span style={{ fontFamily: "monospace" }}>{d.sha1.slice(0, 10)}</span>
                {d.match_id && <><span>·</span><span>matchmaking</span></>}
              </div>
            </div>
            <Link
              href={`/pro/${d.sha1}`}
              className="btn-primary"
              style={{ padding: "8px 16px", fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Escolher player →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
