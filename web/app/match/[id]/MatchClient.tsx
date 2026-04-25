"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { MatchOut, Mood, Orientation, getMatch } from "@/lib/api";
import {
  cancelLocalRender,
  getLocalDemos,
  LocalClientOffline,
  pingLocalClient,
  renderPreflight,
  startLocalRender,
  type DiskIssue,
  type LocalRenderSession,
} from "@/lib/local";
import { getUser } from "@/lib/session";
import { useClientVersionStatus } from "@/lib/useClientVersionStatus";
import AdSlot from "@/components/AdSlot";
import AdModal from "@/components/AdModal";
import UpdateRequiredModal from "@/components/UpdateRequiredModal";

const CS2_TICKRATE = 64;

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
  { id: "reel",  icon: "🎬", label: "Highlights Reel",  format: "vídeo curto · ~20s",          desc: "Intro com player/mapa, rank badges, kill feed animado por frag e stats no outro. Música sincronizada com os cortes.", dest: "Vertical → TikTok / Reels · Horizontal → YouTube Shorts", maxScenes: SCENE_CAPS.reel },
  { id: "card",  icon: "🖼️", label: "Story Card",       format: "9:16 imagem estática",       desc: "Card com nick, mapa, K/D, HS%, ADR, rating e top play. Perfeito para stories.",         dest: "Instagram Stories · WhatsApp", maxScenes: SCENE_CAPS.card },
  { id: "recap", icon: "📺", label: "Recap Completo",   format: "vídeo longo · ~50-90s",       desc: "Narrativa da partida: frags, clutches, estatísticas sobrepostas e placar round a round.",    dest: "Vertical → Reels longos · Horizontal → YouTube / Twitch", maxScenes: SCENE_CAPS.recap },
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
  // vertical = TikTok/Reels (default); horizontal = YouTube/Twitch.
  // Card é sempre vertical (formato semântico do produto), backend força.
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [generating, setGenerating] = useState(false);
  const [jobMsg, setJobMsg] = useState<string | null>(null);
  const [showAd, setShowAd] = useState(false);
  const [renderDuration, setRenderDuration] = useState(90);
  const [elapsed, setElapsed] = useState(0);
  const [localRender, setLocalRender] = useState(false);
  const [cs2BusyPrompt, setCs2BusyPrompt] = useState<{ open: boolean; pids?: number[] }>({ open: false });
  // Render-blocked prompts (preflight passou mas backend recusou). A gente
  // mostra modal explicando o porquê em vez de cair num "fallback server"
  // fantasma — o pipeline de render é 100% local hoje.
  const [diskFullPrompt, setDiskFullPrompt] = useState<{ open: boolean; issues?: DiskIssue[] }>({ open: false });
  const [clientOfflinePrompt, setClientOfflinePrompt] = useState(false);
  const [renderErrorPrompt, setRenderErrorPrompt] = useState<{ open: boolean; message?: string }>({ open: false });
  // Gate de versão: o `.exe` instalado precisa estar igual ou mais novo que
  // a última release publicada (buscada de /api/client-version → GitHub API)
  // pra evitar usuário gerar reels com bugs já corrigidos (ex: ProRes .mov
  // ilegível pré-v0.2.9). O hook polla /version a cada 8s.
  const clientVersion = useClientVersionStatus();
  const [updatePrompt, setUpdatePrompt] = useState(false);
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
    setLocalRender(false);

    // Render é 100% local: HLAE captura no PC do user, ffmpeg converte,
    // arquivo final cai no Desktop. NÃO existe fallback server-side hoje —
    // a "geração via server" foi removida porque o backend ainda não tem
    // Remotion. Se algo falhar aqui, mostramos modal explicando.
    try {
      const clientOnline = await pingLocalClient();
      if (!clientOnline) {
        setClientOfflinePrompt(true);
        return;
      }

      // Gate de versão. Sem auto-update no `.exe`, deixar usuário antigo
      // disparar render gera reels com bugs corrigidos (ex: ProRes .mov
      // ilegível em WMP pré-v0.2.9, câmera estática pré-v0.2.6, ou bate
      // em endpoints novos como /render/open com 404). Bloqueia hard.
      if (clientVersion.status === "outdated") {
        setUpdatePrompt(true);
        return;
      }

      // Localiza a .dem pelo match_id (já indexada pelo scanner local).
      const demos = await getLocalDemos();
      const localDemo = demos.matches.find((d) => d.match_id === match.id);
      if (!localDemo) {
        setRenderErrorPrompt({
          open: true,
          message:
            "Não achei a demo desta partida no seu PC. Confirme que o arquivo .dem ainda está em replays/ e tente de novo.",
        });
        return;
      }

      const pre = await renderPreflight();
      if (!pre.ready) {
        if (pre.reason === "cs2_running") {
          setCs2BusyPrompt({ open: true, pids: pre.cs2_pids });
          return;
        }
        if (pre.reason === "render_in_progress") {
          setRenderErrorPrompt({
            open: true,
            message:
              "Já tem um render rolando no FragReel. Espere terminar (ou cancele) antes de começar outro.",
          });
          return;
        }
        setRenderErrorPrompt({
          open: true,
          message: "FragReel client não está pronto pra renderizar agora. Reinicie o app e tente de novo.",
        });
        return;
      }

      const selectedHighlights = match.highlights.filter((h) => selected.has(h.rank));
      const segments = selectedHighlights.map((h) => ({
        start_tick: Math.max(0, Math.floor(h.start * CS2_TICKRATE)),
        end_tick: Math.max(1, Math.floor(h.end * CS2_TICKRATE)),
        // v0.3.0-alpha: repassa `kill_ticks` / `kill_timestamps` do server
        // pra cada highlight. Client v0.3.0-beta+ usa pra `cluster_round_kills()`
        // capturar só os trechos com ação dentro do round em vez do round
        // inteiro. Clients v0.2.x ignoram esses campos e caem no round window
        // completo (fallback gracioso). Demos parseadas por scorers
        // pre-v0.3.0-alpha não têm esses campos e o spread de `undefined`
        // faz JSON.stringify omitir as chaves.
        kill_ticks: h.kill_ticks,
        kill_timestamps: h.kill_timestamps,
        // v0.3.0-beta-2: scenario context pro cluster_round_kills_v2
        // ajustar pads + garantir cobertura inteira de plant/defuse.
        // Vê algoritmo final em [[v0.3 Cluster Tuning Research]].
        clutch_situation: h.clutch_situation,
        is_round_winning_kill: h.is_round_winning_kill,
        bomb_action: h.bomb_action,
        bomb_action_tick: h.bomb_action_tick,
      }));

      // Sem player name + steamid64, o capture_script.py cai pro free-cam
      // (CS2 não tem spec_player_by_accountid — precisa do nome string).
      // Pega do JWT do Steam OAuth: name = display name do Steam, steamid =
      // SteamID64. Bug #11 (catched 25/04 madrugada-4): user.name é o
      // STEAM display name que pode divergir do nome in-game CS2 (ex: Steam
      // = "Mathieu Anduze", in-game = "donk"). Mismatch faz spec_player
      // falhar silencioso no CS2 console → câmera vira free-cam autodirector
      // → reel mostra outro player. Fix v0.3.0-beta-3: server agora extrai
      // o name in-game do parser e expõe em match.player_name. Web prefere
      // esse, com fallback no Steam display name pra demos antigas.
      const user = getUser();
      const inGameName = match.player_name || user?.name || undefined;
      try {
        await startLocalRender({
          demo_path: localDemo.demo_path,
          segments,
          user_steamid64: user?.steamid || undefined,
          user_player_name: inGameName,
        });
        setLocalRender(true);
        setRenderDuration(
          Math.max(30, Math.ceil(segments.reduce((s, x) => s + (x.end_tick - x.start_tick), 0) / CS2_TICKRATE * 4)),
        );
        setJobMsg("Renderizando no seu PC com gameplay real (HLAE).");
        setShowAd(true);
      } catch (e) {
        const err = e as Error & { code?: string; cs2_pids?: number[]; issues?: DiskIssue[] };
        if (err instanceof LocalClientOffline) {
          setClientOfflinePrompt(true);
          return;
        }
        if (err.code === "cs2_running") {
          setCs2BusyPrompt({ open: true, pids: err.cs2_pids });
          return;
        }
        if (err.code === "insufficient_disk") {
          setDiskFullPrompt({ open: true, issues: err.issues });
          return;
        }
        // Erro inesperado — surfaceia mensagem real (sem fallback fantasma).
        setRenderErrorPrompt({
          open: true,
          message: err.message || "Falha desconhecida ao iniciar o render.",
        });
      }
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
          matchId={match.id}
          format={format}
          localRenderMode={localRender}
          onClose={() => {
            if (localRender) cancelLocalRender().catch(() => {});
            setShowAd(false);
          }}
        />
      )}

      {diskFullPrompt.open && (
        <div
          onClick={() => setDiskFullPrompt({ open: false })}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              background: "#13131f",
              border: "1px solid #2D2D44",
              borderRadius: 14,
              padding: 28,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>💾</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
              Sem espaço em disco pra capturar
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 14 }}>
              O HLAE captura cada frame da partida como TGA não-comprimido (necessário pra qualidade
              do vídeo final). Esses arquivos vão pro drive onde o CS2 está instalado e somem assim
              que o ffmpeg termina de converter.
            </p>
            {diskFullPrompt.issues && diskFullPrompt.issues.length > 0 && (
              <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {diskFullPrompt.issues.map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 12px",
                      background: "rgba(255,107,53,0.06)",
                      border: "1px solid rgba(255,107,53,0.25)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "rgba(255,255,255,0.75)",
                      lineHeight: 1.55,
                    }}
                  >
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                      {issue.drive}
                    </div>
                    <div>
                      Precisa de <b style={{ color: "#FF6B35" }}>{issue.needed_gb.toFixed(1)} GB</b>,
                      mas só tem <b style={{ color: "#ffb088" }}>{issue.free_gb.toFixed(1)} GB</b> livres.
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.55, marginBottom: 20 }}>
              <b style={{ color: "rgba(255,255,255,0.7)" }}>Soluções:</b> liberar espaço no drive,
              selecionar menos cenas (cada highlight ocupa ~7 GB de TGA), ou aguardar o suporte
              a redirecionamento de captura pra outro drive (em breve).
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDiskFullPrompt({ open: false })}
                className="btn-primary"
                style={{ fontSize: 13, padding: "9px 18px" }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {updatePrompt && (
        <UpdateRequiredModal
          localVersion={clientVersion.local}
          onClose={() => setUpdatePrompt(false)}
        />
      )}

      {clientOfflinePrompt && (
        <div
          onClick={() => setClientOfflinePrompt(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              background: "#13131f",
              border: "1px solid #2D2D44",
              borderRadius: 14,
              padding: 28,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>🔌</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
              Abra o FragReel client
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 20 }}>
              Pra renderizar, o FragReel.exe precisa estar rodando no seu PC. Abra ele
              (vai aparecer um ícone na bandeja do sistema) e clique em <b>Renderizar</b>{" "}
              de novo.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setClientOfflinePrompt(false)}
                className="btn-primary"
                style={{ fontSize: 13, padding: "9px 18px" }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {renderErrorPrompt.open && (
        <div
          onClick={() => setRenderErrorPrompt({ open: false })}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 460,
              background: "#13131f",
              border: "1px solid #2D2D44",
              borderRadius: 14,
              padding: 28,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
              Não consegui iniciar o render
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 20 }}>
              {renderErrorPrompt.message}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setRenderErrorPrompt({ open: false })}
                className="btn-primary"
                style={{ fontSize: 13, padding: "9px 18px" }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {cs2BusyPrompt.open && (
        <div
          onClick={() => setCs2BusyPrompt({ open: false })}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              background: "#13131f",
              border: "1px solid #2D2D44",
              borderRadius: 14,
              padding: 28,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>🎮</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
              Feche o Counter-Strike 2 primeiro
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 20 }}>
              O FragReel precisa abrir o CS2 invisível no seu PC pra gerar o vídeo.
              Se você tem uma partida rolando, a gente não vai interromper — feche
              o CS2 quando puder e clique em <b>Renderizar</b> de novo.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setCs2BusyPrompt({ open: false })}
                className="btn-primary"
                style={{ fontSize: 13, padding: "9px 18px" }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 60px" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 28, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          <Link href="/library" style={{ color: "inherit", textDecoration: "none" }}>Minhas Demos</Link>
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
                      {/* v0.3.0-alpha badges contextuais. Server expõe em `HighlightOut`;
                          demos antigas parseadas por scorer pre-v0.3 retornam undefined
                          e nenhum badge aparece (fallback gracioso). Ordem de prioridade:
                          clutch > bomb > RWK — reflete o valor narrativo decrescente. */}
                      {h.clutch_situation && (
                        <span
                          title={`Ficou em ${h.clutch_situation} e ${h.won_round ? "venceu" : "perdeu"} o round`}
                          style={{ fontSize: 11, fontWeight: 700, color: "#FFC857", background: "rgba(255,200,87,0.12)", border: "1px solid rgba(255,200,87,0.35)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          ⚡ {h.clutch_situation} Clutch
                        </span>
                      )}
                      {h.bomb_action === "defuse" && (
                        <span
                          title="Defusou a bomba neste round"
                          style={{ fontSize: 11, fontWeight: 700, color: "#5D9CEC", background: "rgba(93,156,236,0.12)", border: "1px solid rgba(93,156,236,0.35)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          💣 Defuse
                        </span>
                      )}
                      {h.bomb_action === "plant_won" && (
                        <span
                          title="Plantou a bomba e o time venceu o round"
                          style={{ fontSize: 11, fontWeight: 700, color: "#E8A855", background: "rgba(232,168,85,0.12)", border: "1px solid rgba(232,168,85,0.35)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          💣 Plant
                        </span>
                      )}
                      {h.is_round_winning_kill && (
                        <span
                          title="A última kill do round foi sua (Round-Winning Kill)"
                          style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", background: "rgba(255,107,53,0.12)", border: "1px solid rgba(255,107,53,0.35)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          ★ RWK
                        </span>
                      )}
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

        {/* Orientation selector — só faz sentido pra formatos de vídeo.
             Card sempre é 9:16 vertical (story de Instagram). */}
        {(format === "reel" || format === "recap") && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Onde você vai postar?</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
              Define o formato do vídeo final. Vertical é o padrão de mobile (TikTok/Reels), horizontal é o padrão YouTube/Twitch.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {([
                { id: "vertical" as const, icon: "📱", label: "Vertical · 9:16", desc: "TikTok · Reels · Shorts · WhatsApp", dim: "1080×1920" },
                { id: "horizontal" as const, icon: "🖥", label: "Horizontal · 16:9", desc: "YouTube · Twitch · Discord", dim: "1920×1080" },
              ]).map((o) => {
                const active = orientation === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setOrientation(o.id)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: active ? "2px solid #FF6B35" : "1px solid #2D2D44",
                      background: active ? "rgba(255,107,53,0.06)" : "#16213E",
                      cursor: "pointer",
                      textAlign: "left",
                      position: "relative",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    {active && (
                      <div style={{ position: "absolute", top: 10, right: 10, width: 16, height: 16, borderRadius: "50%", background: "#FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "white" }}>✓</div>
                    )}
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{o.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: active ? "#FF6B35" : "#E8E8F0", marginBottom: 2 }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{o.desc}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginTop: 4 }}>{o.dim}</div>
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
