"use client";

import { useEffect, useState } from "react";
import { getUser, type SessionUser } from "@/lib/session";
import { useSteamGCStatus } from "@/lib/useSteamGCStatus";
import SteamLoginModal from "./SteamLoginModal";
import DownloadButton from "./DownloadButton";
import MatchCard, { type MatchCardData } from "./MatchCard";

/**
 * MatchesContent — orchestrador do flow Sprint DEMO-3.
 *
 * Estados:
 *   - Steam OAuth não logado → CTA login Steam (web)
 *   - Logado, client offline → "Olá {name}, baixe o client" + preview
 *   - Logado, client OK, sem credentials → CTA "Conectar matches" (modal)
 *   - Logado, credentials OK, sem auth_code → CTA "Ativar match sharing"
 *   - Tudo OK → match list real
 */
export default function MatchesContent() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [authCodeFlowOpen, setAuthCodeFlowOpen] = useState(false);
  const gc = useSteamGCStatus(5000);

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
    const onFocus = () => setUser(getUser());
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, []);

  if (!hydrated) {
    return <SkeletonState />;
  }

  // Estado 1: Steam OAuth não logado
  if (!user) {
    return <NotLoggedInState />;
  }

  // Estado 2: Steam logged + client offline
  if (gc.state === "checking" || gc.state === "client_offline") {
    return <ClientOfflineState user={user} checking={gc.state === "checking"} />;
  }

  // Estado 3: Client OK + Steam credentials needed
  if (gc.state === "needs_credentials") {
    return (
      <>
        <NeedsCredentialsState user={user} onConnect={() => setLoginModalOpen(true)} />
        {loginModalOpen && (
          <SteamLoginModal
            onClose={() => setLoginModalOpen(false)}
            onSuccess={() => setLoginModalOpen(false)}
          />
        )}
      </>
    );
  }

  // Estado 4: Credentials OK + auth_code needed
  if (gc.state === "needs_auth_code") {
    return (
      <NeedsAuthCodeState
        user={user}
        steamid64={gc.steamid64}
        onComplete={() => {/* state machine re-tick automatic */}}
      />
    );
  }

  // Estado 5: Tudo OK — match list
  return <ReadyState user={user} steamid64={gc.steamid64} />;
}

// ── State components ────────────────────────────────────────────────────────

function SkeletonState() {
  return (
    <div>
      <h1 style={titleStyle}>Match History</h1>
      <div style={{ marginTop: 32, opacity: 0.4, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
        Carregando...
      </div>
    </div>
  );
}

function NotLoggedInState() {
  return (
    <div>
      <h1 style={titleStyle}>Match History</h1>
      <p style={subtitleStyle}>
        Suas partidas CS2 ranqueadas pela IA — vê quais kills viraram replay POV
        antes mesmo de gerar o reel.
      </p>
      <div style={emptyCardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", marginBottom: 8 }}>
          Conecte sua Steam
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 24, maxWidth: 460, lineHeight: 1.55 }}>
          Login pelo Steam pra ver suas matches CS2 sem precisar abrir o jogo
          ou achar pasta de demos. Único acesso: nickname e avatar público.
        </p>
        <a
          href="/login"
          style={primaryBtnStyle}
        >
          Entrar com Steam
        </a>
      </div>
    </div>
  );
}

function ClientOfflineState({ user, checking }: { user: SessionUser; checking: boolean }) {
  return (
    <div>
      <h1 style={titleStyle}>
        Olá, <span style={{ color: "#FF8E53" }}>{user.name}</span>
      </h1>
      <p style={subtitleStyle}>
        Pra ver suas partidas CS2 aqui, instala o FragReel client (1x). Ele
        roda em segundo plano e busca suas matches automaticamente.
      </p>

      <div style={emptyCardStyle}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: checking ? "rgba(255,193,7,0.5)" : "rgba(255,107,53,0.5)",
            flexShrink: 0,
          }} />
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
            {checking ? "Detectando client local..." : "Client desktop não detectado"}
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", marginBottom: 10 }}>
          Próximo passo: instalar o FragReel
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 16, lineHeight: 1.55 }}>
          Download direto, sem cadastro. Renderiza no seu PC (qualidade Major,
          sem custo de servidor pra você).
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <DownloadButton
            className="btn-primary"
            style={{ fontSize: 14, padding: "10px 22px" }}
          >
            ⬇ Baixar grátis pro Windows
          </DownloadButton>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>
            ~120 MB · Windows 10/11
          </span>
        </div>

        {/* Preview empty state — mostra o que VAI aparecer pós install */}
        <div style={{
          marginTop: 32,
          padding: 20,
          background: "rgba(255,255,255,0.025)",
          border: "1px dashed rgba(255,255,255,0.10)",
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Preview · pós install
          </div>
          <PreviewMatchCard score="13:11" map="OVERPASS" mode="Competitive" kd="15/16" hsCount={5} />
          <PreviewMatchCard score="16:13" map="MIRAGE" mode="Premier" kd="22/14" hsCount={9} />
          <PreviewMatchCard score="13:9" map="INFERNO" mode="Competitive" kd="20/17" hsCount={6} />
        </div>
      </div>
    </div>
  );
}

function NeedsCredentialsState({
  user,
  onConnect,
}: {
  user: SessionUser;
  onConnect: () => void;
}) {
  return (
    <div>
      <h1 style={titleStyle}>
        Olá, <span style={{ color: "#FF8E53" }}>{user.name}</span>
      </h1>
      <p style={subtitleStyle}>
        FragReel rodando ✓. Falta conectar com sua conta Steam pra ver as matches.
      </p>

      <div style={emptyCardStyle}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "rgba(91,227,143,0.7)",
            flexShrink: 0,
          }} />
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
            Client conectado
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", marginBottom: 10 }}>
          Conectar matches CS2 (1x)
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 16, lineHeight: 1.55 }}>
          Login Steam dentro do FragReel — credenciais ficam no seu PC, nunca
          passam pelo nosso servidor. Mesma arquitetura Faceit/Leetify.
        </p>

        <button onClick={onConnect} style={primaryBtnStyle}>
          Conectar Steam
        </button>
      </div>
    </div>
  );
}

function NeedsAuthCodeState({
  user,
  steamid64,
  onComplete,
}: {
  user: SessionUser;
  steamid64: string | null;
  onComplete: () => void;
}) {
  const [authCode, setAuthCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!authCode.trim()) {
      setErrorMsg("Cola o código de 4-5 caracteres do Steam.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("http://127.0.0.1:5775/api/steam/auth-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_code: authCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(`Erro: ${data.error || res.status}`);
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      onComplete();
    } catch (e) {
      setErrorMsg("Falha de conexão com o client.");
      setSubmitting(false);
    }
  };

  const steamPageUrl = steamid64
    ? `https://help.steampowered.com/wizard/HelpWithGameIssue/?appid=730&issueid=128`
    : "https://help.steampowered.com/wizard/HelpWithGameIssue/?appid=730";

  return (
    <div>
      <h1 style={titleStyle}>Quase lá!</h1>
      <p style={subtitleStyle}>
        Última etapa: ativar match sharing com a Steam (1x setup).
      </p>

      <div style={emptyCardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", marginBottom: 10 }}>
          Match Sharing Code
        </h2>

        <ol style={{ paddingLeft: 20, color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
          <li>
            <a
              href={steamPageUrl}
              target="_blank"
              rel="noopener"
              style={{ color: "#FF8E53", textDecoration: "underline" }}
            >
              Abrir página Steam (clique aqui)
            </a>
          </li>
          <li>Steam mostra um código de 4-5 caracteres</li>
          <li>Cola abaixo:</li>
        </ol>

        <input
          type="text"
          value={authCode}
          onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
          placeholder="ABC1"
          maxLength={10}
          autoFocus
          autoComplete="off"
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "rgba(0,0,0,0.30)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 8,
            color: "rgba(255,255,255,0.95)",
            fontSize: 16,
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.15em",
            textAlign: "center",
            outline: "none",
            marginBottom: 14,
          }}
        />

        {errorMsg && (
          <div style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "rgba(255,107,53,0.10)",
            border: "1px solid rgba(255,107,53,0.30)",
            borderRadius: 6,
            fontSize: 12,
            color: "#FFB088",
          }}>
            {errorMsg}
          </div>
        )}

        <button onClick={submit} disabled={submitting} style={primaryBtnStyle}>
          {submitting ? "Salvando..." : "Conectar"}
        </button>
      </div>
    </div>
  );
}

function ReadyState({
  user,
  steamid64,
}: {
  user: SessionUser;
  steamid64: string | null;
}) {
  const [matches, setMatches] = useState<{
    matches: unknown[];
    count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("http://127.0.0.1:5775/api/steam/match-history");
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(`Erro: ${data.error || res.status}`);
          setLoading(false);
          return;
        }
        setMatches(data);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError("Falha conexão com client.");
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <h1 style={titleStyle}>Match History</h1>
      <p style={subtitleStyle}>
        Últimas partidas CS2 de <strong style={{ color: "rgba(255,255,255,0.85)" }}>{user.name}</strong>.
        IA ranqueia kills automaticamente — kills marcadas <span style={{ color: "#FFB088", fontWeight: 700 }}>KILL POV</span> ganham replay especial.
      </p>

      {loading && (
        <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Carregando suas matches via Steam GC...
        </div>
      )}

      {error && (
        <div style={{ ...emptyCardStyle, color: "#FFB088" }}>
          {error}
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 8 }}>
            Pode ser que GC connection caiu temporariamente. Aguarda alguns segundos e refresh.
          </p>
        </div>
      )}

      {matches && matches.count === 0 && (
        <div style={emptyCardStyle}>
          Nenhuma match encontrada nas últimas 8. Joga uma partida CS2 e volta aqui.
        </div>
      )}

      {matches && matches.count > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
            {matches.count} matches recentes
          </div>
          {/* Sprint 4: cards visuais. Map raw GC proto → MatchCardData shape.
              Sprint 5 expand: side panel com roster + 2 CTAs ao click. */}
          {(matches.matches as Array<Record<string, unknown>>).map((raw, i) => (
            <MatchCard
              key={(raw.match_id as string) || (raw.sharecode as string) || `m-${i}`}
              match={mapGCProtoToCardData(raw, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── GC proto → MatchCardData mapping ─────────────────────────────────────────

/**
 * Map raw match proto (do steam_gc.js parseMatchProto) → MatchCardData.
 *
 * GC proto fields esperados (parseMatchProto em steam_gc_sidecar/steam_gc.js):
 *   match_id, match_time, watchable {server_ip, ...}, sharecode, demo_url
 *
 * Sprint 5 vai enrichar com roundstats_legacy data (score, K/D, etc) — GC
 * retorna em estrutura aninhada. Por enquanto MVP usa fallbacks.
 */
function mapGCProtoToCardData(raw: Record<string, unknown>, idx: number): MatchCardData {
  const matchId = (raw.match_id as string) || (raw.sharecode as string) || `match-${idx}`;
  const matchTimeUnix = raw.match_time
    ? Number(raw.match_time) * 1000  // GC usa segundos
    : undefined;

  // Demo URL → status
  const demoUrl = raw.demo_url as string | null | undefined;
  let status: "downloaded" | "available" | "expired" | "unknown" = "unknown";
  if (demoUrl) {
    status = "available";
    // TODO Sprint 5: cross-check com /demos local pra detectar "downloaded"
    if (matchTimeUnix) {
      const ageDays = (Date.now() - matchTimeUnix) / (1000 * 60 * 60 * 24);
      if (ageDays > 30) status = "expired";
    }
  }

  // Roundstats — Sprint 5 parse roundstats_legacy / roundstats_all
  // pra extrair score CT/T + K/D do user. MVP retorna placeholders.
  return {
    id: matchId,
    mapName: undefined,  // Sprint 5: extract from roundstats.map ou similar
    score: undefined,    // Sprint 5: roundstats_legacy.team_scores[0]:[1]
    mode: "Competitive", // Sprint 5: determinar via match_type
    kd: undefined,       // Sprint 5: roundstats per-player
    hsCount: undefined,
    matchTime: matchTimeUnix,
    demoUrl: demoUrl ?? null,
    status,
    outcome: null,       // Sprint 5: comparar score com user team
  };
}

// ── Preview match card (mock pré-install) ────────────────────────────────────

function PreviewMatchCard({
  score,
  map,
  mode,
  kd,
  hsCount,
}: {
  score: string;
  map: string;
  mode: string;
  kd: string;
  hsCount: number;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      gap: 14,
      alignItems: "center",
      padding: 12,
      background: "rgba(0,0,0,0.30)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
      marginBottom: 8,
      opacity: 0.55,
      filter: "blur(0.5px)",
    }}>
      <div style={{
        width: 80,
        height: 48,
        borderRadius: 6,
        background: "linear-gradient(135deg, rgba(255,107,53,0.10), #0d0d18 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "rgba(255,255,255,0.65)",
        fontFamily: "ui-monospace, monospace",
      }}>
        {map}
      </div>
      <div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600, marginBottom: 2 }}>
          {score} · {mode}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "ui-monospace, monospace" }}>
          KD {kd} · {hsCount} HS
        </div>
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.30)", fontFamily: "ui-monospace, monospace" }}>
        — • —
      </div>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  marginBottom: 8,
  color: "#E8E8F0",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.55)",
  maxWidth: 720,
  lineHeight: 1.6,
  marginBottom: 32,
};

const emptyCardStyle: React.CSSProperties = {
  padding: 24,
  background: "rgba(26,26,46,0.30)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 22px",
  background: "linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%)",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  letterSpacing: "0.01em",
  boxShadow: "0 4px 20px rgba(255, 107, 53, 0.30)",
};
