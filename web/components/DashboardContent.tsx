"use client";

import { useState, useEffect } from "react";
import MatchList from "@/components/MatchList";
import AdSlot from "@/components/AdSlot";
import Link from "next/link";
import { CLIENT_VERSION } from "@/lib/version";
import { pingLocalClient, getLocalClientVersion } from "@/lib/local";
import { getMatches, type MatchSummary } from "@/lib/api";

type ClientStatus = "checking" | "online" | "offline";

export default function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientStatus, setClientStatus] = useState<ClientStatus>("checking");
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(true);

  // Ping ao client local — define se mostra hero de download ou estado "tudo certo".
  // Quando online, lê /version pra detectar update disponível.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const ok = await pingLocalClient();
      if (!alive) return;
      setClientStatus(ok ? "online" : "offline");
      if (ok) {
        const v = await getLocalClientVersion();
        if (alive) setInstalledVersion(v);
      } else {
        setInstalledVersion(null);
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Carrega matches uma vez (e a cada refreshKey)
  useEffect(() => {
    let alive = true;
    setMatchesLoading(true);
    getMatches()
      .then((m) => { if (alive) setMatches(m); })
      .catch(() => { if (alive) setMatches([]); })
      .finally(() => { if (alive) setMatchesLoading(false); });
    return () => { alive = false; };
  }, [refreshKey]);

  // Auto-refresh a cada 30s pra pegar partidas que o client acabou de enviar.
  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const hasMatches = (matches?.length ?? 0) > 0;
  const showOnboarding = clientStatus === "offline" && !hasMatches;
  const showQuietHeader = clientStatus === "online" || hasMatches;
  const updateAvailable =
    clientStatus === "online" &&
    installedVersion !== null &&
    installedVersion !== CLIENT_VERSION;

  return (
    <>
      {/* ── Banner de update — visível MESMO quando o client está conectado */}
      {updateAvailable && (
        <div style={{
          padding: "14px 18px",
          marginBottom: 16,
          background: "linear-gradient(90deg, rgba(255,107,53,0.14), rgba(167,139,250,0.10))",
          border: "1px solid rgba(255,107,53,0.45)",
          borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
          fontSize: 13,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <div>
              <div style={{ fontWeight: 700, color: "#FF6B35", marginBottom: 2 }}>
                Nova versão disponível: {CLIENT_VERSION}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                Você está rodando {installedVersion}. Baixa a versão nova pra pegar
                as últimas correções.
              </div>
            </div>
          </div>
          <a
            href="/download"
            download="FragReel.exe"
            style={{
              fontSize: 13, fontWeight: 700,
              background: "#FF6B35", color: "white",
              padding: "9px 18px", borderRadius: 8,
              textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            ⬇ Atualizar agora
          </a>
        </div>
      )}

      {/* ── Onboarding hero — só aparece se client offline E sem matches */}
      {showOnboarding && (
        <div style={{
          padding: "32px 36px",
          background: "linear-gradient(135deg, rgba(255,107,53,0.10) 0%, rgba(167,139,250,0.06) 100%)",
          border: "1px solid rgba(255,107,53,0.30)",
          borderRadius: 16,
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 32,
          alignItems: "center",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>🎬</span>
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>FragReel para Windows</span>
              <span style={{ fontSize: 11, background: "#FF6B35", color: "white", padding: "3px 9px", borderRadius: 5, fontWeight: 700, letterSpacing: "0.04em" }}>BETA</span>
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: "0 0 18px", maxWidth: 520 }}>
              O client lê as demos do CS2 que já estão no seu PC e expõe pra esta página.
              Você escolhe qual partida virar FragReel — nenhuma demo sai do seu computador
              sem você clicar.
            </p>
            <div style={{ display: "flex", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "#4CAF82", fontSize: 15 }}>✓</span> Lê demos do CS2 localmente
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "#4CAF82", fontSize: 15 }}>✓</span> Detecção de highlights por IA
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "#4CAF82", fontSize: 15 }}>✓</span> Open source · MIT</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <a
              href="/download"
              download="FragReel.exe"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#FF6B35",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                padding: "12px 22px",
                borderRadius: 10,
                textDecoration: "none",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
            >
              ⬇ Baixar client · {CLIENT_VERSION}
            </a>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "right" }}>
              Windows 10/11 · ~120 MB · Última versão {CLIENT_VERSION}
            </span>
          </div>
        </div>
      )}

      {/* ── Quiet header — quando client tá rodando ou já tem matches:
              mostra status compacto sem repetir o passo a passo */}
      {showQuietHeader && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          marginBottom: 24,
          background: clientStatus === "online" ? "rgba(91,227,143,0.06)" : "rgba(255,107,53,0.06)",
          border: `1px solid ${clientStatus === "online" ? "rgba(91,227,143,0.25)" : "rgba(255,107,53,0.25)"}`,
          borderRadius: 12,
          fontSize: 13,
          flexWrap: "wrap",
          gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: clientStatus === "online" ? "#5be38f" : "#FF6B35",
              boxShadow: clientStatus === "online" ? "0 0 8px rgba(91,227,143,0.5)" : "none",
            }} />
            <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
              {clientStatus === "online"
                ? "Client conectado · suas demos novas aparecem em Minhas Demos"
                : clientStatus === "checking"
                  ? "Verificando client…"
                  : "Client desconectado · abra o FragReel.exe no PC pra ler novas demos"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link
              href="/library"
              style={{
                fontSize: 12, fontWeight: 600,
                color: "#FF6B35", padding: "6px 14px",
                background: "rgba(255,107,53,0.10)",
                border: "1px solid rgba(255,107,53,0.40)",
                borderRadius: 7, textDecoration: "none",
              }}
            >
              📂 Minhas Demos
            </Link>
            {/* CTA de download SEMPRE presente — não-clicável quando o client
                está rodando (mostra a versão instalada). User pediu: "deixe o
                CTA pra baixar o fragreel sempre presente, mas não clicável,
                como está aguardando processamento." */}
            {clientStatus === "online" ? (
              <span
                title="Client rodando — não precisa baixar de novo"
                style={{
                  fontSize: 12, fontWeight: 600,
                  color: "rgba(255,255,255,0.4)", padding: "6px 14px",
                  border: "1px dashed #2D2D44",
                  borderRadius: 7,
                  cursor: "default",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                ⬇ {installedVersion ?? CLIENT_VERSION} <span style={{ color: "#5be38f" }}>● rodando</span>
              </span>
            ) : (
              <a
                href="/download"
                download="FragReel.exe"
                style={{
                  fontSize: 12, fontWeight: 600,
                  color: "rgba(255,255,255,0.6)", padding: "6px 14px",
                  border: "1px solid #2D2D44",
                  borderRadius: 7, textDecoration: "none",
                }}
              >
                ⬇ {CLIENT_VERSION}
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Steps — só faz sentido pra quem nunca usou (offline + sem matches) */}
      {showOnboarding && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 40 }}>
          {[
            { step: "1", icon: "⬇", title: "Baixa e instala", desc: "Instalar FragReel.exe. Login com Steam uma vez só." },
            { step: "2", icon: "📂", title: "Abre a Biblioteca", desc: "O client lista as demos do seu CS2. Você escolhe qual virar FragReel." },
            { step: "3", icon: "🎬", title: "Assiste 1 ad, baixa o vídeo", desc: "Enquanto a IA monta o reel, você assiste 1 anúncio. Pronto, baixou." },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} style={{ padding: "18px 20px", background: "#16213E", border: "1px solid #2D2D44", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FF6B3520", border: "1px solid rgba(255,107,53,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#FF6B35", flexShrink: 0 }}>{step}</div>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.55, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Section header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>
          {hasMatches ? `${matches!.length} FragReels gerados` : "Seus FragReels"}
        </h2>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          {matchesLoading ? "carregando…" : "atualiza a cada 30s"}
        </span>
      </div>

      {/* Ad — leaderboard só quando há conteúdo (não polui empty state) */}
      {hasMatches && (
        <div style={{ marginBottom: 20 }}>
          <AdSlot id="dashboard-leaderboard" size="leaderboard" label="SteelSeries · Periféricos para CS2" />
        </div>
      )}

      {/* Match list */}
      <MatchList refreshKey={refreshKey} />

      {/* Ad — native, só quando há partidas */}
      {hasMatches && (
        <div style={{ marginTop: 32 }}>
          <AdSlot id="dashboard-native" size="native" label="Patrocinado · KaBuM! Gaming" />
        </div>
      )}
    </>
  );
}
