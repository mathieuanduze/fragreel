"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { MatchOut, HighlightOut, Mood, Orientation, getMatch } from "@/lib/api";
import {
  cancelLocalRender,
  getLocalDemosAwaitingScan,
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

// Reel-only desde 28/04 (Decisão definitiva #1 do ROADMAP — drop card + recap
// pra v1.0 launch). Formatos card (estático) e recap (longo) foram removidos
// — single proposta: Reel pra TikTok/Reels/Shorts/YouTube/Twitch.
//
// Reel: 5 cenas é o sweet spot pra timeline curta (~20s). Mais cenas começa
// a parecer rápido demais, e o custo de render escala (cada cena = re-encode
// + transição). Teto duro evita user cobrar 5 minutos de render num reel curto.
const SCENE_CAPS: Record<string, number> = {
  reel: 5,
};

const FORMATS = [
  { id: "reel",  icon: "🎬", label: "Highlights Reel",  format: "vídeo curto · ~20s",          desc: "Intro com player/mapa, rank badges, kill feed animado por frag e stats no outro. Música sincronizada com os cortes.", dest: "Vertical → TikTok / Reels / Shorts · Horizontal → YouTube / Twitch", maxScenes: SCENE_CAPS.reel },
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

// Sprint #6.4 — variants per mood. Espelhar editor/src/theme.ts MOODS[mood].tracks.
// MUDOU LÁ → atualizar AQUI (manual sync, no pipe automatic — TODO Sprint
// dedicada de design system se essa lista crescer muito).
const MOOD_VARIANTS: Record<Mood, { label: string }[]> = {
  acao: [{ label: "Original" }],
  eletronica: [{ label: "Original" }],
  heroico: [{ label: "Original" }],
  chill: [{ label: "Original" }],
};

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

// ── v0.3.1 (Sprint A1) — Hero badge pra HighlightCard ────────────────────
//
// Substitui thumbnail (que prometia vídeo inexistente até render rolar) por
// badge da jogada principal centralizado. Prioridade DESCENDENTE:
//   1. ACE (5K)            — narrativa máxima
//   2. Clutch 1vN          — solo against odds
//   3. Defuse              — clímax CT
//   4. Plant_won           — clímax T
//   5. Multikill (3K, 4K)  — alto skill
//   6. RWK                 — last kill closer
//   7. Solo HS             — kill clean
//   8. 2K                  — dupla
//   9. Solo kill           — fallback genérico
//
// Cores reaproveitam paleta dos badges contextuais inline.

interface HeroBadge { icon: string; label: string; fg: string; }

function heroBadgeFor(h: HighlightOut): HeroBadge {
  const nKills = h.kills.length;
  if (nKills >= 5) {
    return { icon: "🔥", label: "ACE", fg: "#FF6B35" };
  }
  if (h.clutch_situation) {
    return { icon: "⚡", label: `${h.clutch_situation}\nCLUTCH`, fg: "#FFC857" };
  }
  if (h.bomb_action === "defuse") {
    return { icon: "💣", label: "DEFUSE", fg: "#5D9CEC" };
  }
  if (h.bomb_action === "plant_won") {
    return { icon: "💣", label: "PLANT", fg: "#E8A855" };
  }
  if (nKills === 4) {
    return { icon: "💀", label: "QUAD KILL", fg: "#FF6B35" };
  }
  if (nKills === 3) {
    return { icon: "💀", label: "TRIPLE KILL", fg: "#FF8C5A" };
  }
  if (h.is_round_winning_kill) {
    return { icon: "★", label: "RWK\nROUND CLOSER", fg: "#FF6B35" };
  }
  if (nKills === 1 && h.kills[0]?.headshot) {
    return { icon: "🎯", label: "HEADSHOT", fg: "rgba(255,255,255,0.85)" };
  }
  if (nKills === 2) {
    return { icon: "💀", label: "DOUBLE", fg: "rgba(255,255,255,0.75)" };
  }
  return { icon: "🎯", label: "KILL", fg: "rgba(255,255,255,0.65)" };
}

function heroBadgeBg(h: HighlightOut): string {
  // Background subtle, do escuro pra cor do badge — gradiente vertical
  const hero = heroBadgeFor(h);
  if (hero.fg.startsWith("rgba")) {
    return "linear-gradient(135deg, #131325, #0D0D1A)";  // neutro
  }
  // Opaca → 12% transparency overlay
  return `linear-gradient(135deg, ${hero.fg}18, #0D0D1A 75%)`;
}

function heroBadgeBorder(h: HighlightOut): string {
  const hero = heroBadgeFor(h);
  if (hero.fg.startsWith("rgba")) return "#2D2D44";
  return `${hero.fg}40`;
}

function heroBadgeAccent(h: HighlightOut): string {
  // Border quando o card está selecionado — versão mais opaca da cor do hero
  const hero = heroBadgeFor(h);
  if (hero.fg.startsWith("rgba")) return "rgba(255,107,53,0.3)";
  return `${hero.fg}80`;
}

/**
 * MatchClient props.
 *
 * Sprint #7 Phase 7.4 (05/05) — adicionado optional `targetSteamid` +
 * `targetName` pra reusar este component no fluxo /demo/[sha]/render
 * (Pro Demo Render). Quando setados, override session.user.steamid e
 * session.user.name no payload do /render.
 *
 * Backwards-compat: ambos opcionais. Quando ausentes, comportamento idêntico
 * ao Sprint I.5 (user logado é o player do reel).
 */
interface MatchClientProps {
  match: MatchOut;
  /** Sprint #7 Phase 7.4 — override session steamid (Pro Demo Render). */
  targetSteamid?: string;
  /** Sprint #7 Phase 7.4 — override session name (Pro Demo Render). */
  targetName?: string;
  /** Sprint #7 hotfix (05/05) — sha1 da demo local pra lookup correto.
   *  Em Pro Demo flow, match.id é filename stem (parse_and_score_locally),
   *  NÃO match_id do scanner. Sem demoSha, demos.matches.find falha → erro
   *  "Não achei a demo". Quando setado, lookup vai por sha1. */
  demoSha?: string;
}

export default function MatchClient({ match: initialMatch, targetSteamid, targetName, demoSha }: MatchClientProps) {
  const [match, setMatch] = useState(initialMatch);
  const [format, setFormat] = useState("reel");
  // Pré-seleção: respeita o cap do formato inicial (reel = 5)
  const [selected, setSelected] = useState<Set<number>>(
    new Set(initialMatch.highlights.slice(0, Math.min(SCENE_CAPS.reel, 3)).map((h) => h.rank))
  );
  const [mood, setMood] = useState<Mood>("acao");
  // Sprint #6.4 (05/05) — variant da track musical do mood (0=primary).
  // Resetado pra 0 quando user troca mood (cada mood tem suas próprias
  // variants). UI só renderiza picker quando mood tem >1 track.
  const [trackVariantIndex, setTrackVariantIndex] = useState<number>(0);
  // Round 4c Fase 1.17 — toggle música. Default ON (mantém comportamento
  // anterior). Quando OFF, só game audio (tiros/passos/voice/bomb beep)
  // toca no MP4 final.
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);
  // Round 4c Fase 1.21 — toggle x-ray (silhuetas glow dos players através
  // de paredes em spec mode). Default OFF (cinematicamente x-ray distrai
  // do gameplay POV). User opt-in via UI. Web envia `show_xray` no payload
  // pro client converter em cvar `spec_show_xray 1` no capture.cfg.
  const [xrayEnabled, setXrayEnabled] = useState<boolean>(false);
  // Round 4c Fase 1.27 — toggle scoreboard top-left. Default ON (mostra
  // CT/T alive count + HP em tempo real, estilo placar HLTV). User opt-out
  // pra estilo "puro POV sem HUD overlays".
  const [scoreboardEnabled, setScoreboardEnabled] = useState<boolean>(true);
  // Sprint #6.1 (05/05) → Sprint Aesthetic (06/05) — "Estilos visuais"
  // sob threshold. Mathieu spec: "minha intenção é que apareça o estilo
  // visual só nas kills esteticamente mais bonitas". Resolução técnica:
  // scorer.ts agora computa aesthetic_score + aesthetic_style per-kill;
  // editor renderiza flash COR-ESPECÍFICA (noscope=dourado, knife=quente,
  // wallbang=branco x-ray, smoke=azul, blind=branco overpower, flick=
  // laranja) APENAS pra kills com style set (score >= 25 threshold).
  // Kills comuns ficam sem efeito. Toggle re-enabled como default OFF —
  // user opt-in até confirmar que distribuição de styled kills está
  // calibrada (anti-fadiga test).
  const [killFlashEnabled, setKillFlashEnabled] = useState<boolean>(false);
  // Sprint #6.2 (05/05) — Bomb timer red bar.
  // 06/05 — Mathieu reportou: "Não vi nenhuma barra vermelha de bomb timer".
  // Default era OFF (opt-in), Mathieu não sabia ativar. Per
  // rule_user_feedback_is_universal_spec: bomb timer é regra de negócio
  // universal (drama factor quando há plant), não opt-in. Default → ON.
  // Comportamento: aparece SÓ em highlights com bomb_planted_timestamp
  // setado pelo scorer. Highlights sem plant ficam silenciosos — sem
  // pollution / fatigue. User pode opt-out via toggle se quiser estilo
  // "puro POV sem HUD overlays".
  const [bombTimerEnabled, setBombTimerEnabled] = useState<boolean>(true);
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
  // (Reel-only desde 28/04 — só 1 formato, mas useEffect mantido pra futuro
  // se voltar formatos extras.)
  useEffect(() => {
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
      // Round 4d field test (PC catched 04/05): primeiro click no render
      // disparava modal "Não achei a demo" porque /demos endpoint dispara
      // bg-scan no first call mas retorna matches=[] imediatamente. Segundo
      // click funcionava (scan completado). Fix: getLocalDemosAwaitingScan
      // poll-aguarda scan_done=true antes de retornar (timeout 10s).
      const demos = await getLocalDemosAwaitingScan();
      // Sprint #7 hotfix (05/05): em Pro Demo flow, match.id = filename stem
      // do parse_and_score_locally, NÃO match_id do scanner. Lookup por sha1
      // quando demoSha é prop (override). Senão (legacy /match/[id] flow),
      // lookup por match_id como antes.
      const localDemo = demoSha
        ? demos.matches.find((d) => d.sha1 === demoSha)
        : demos.matches.find((d) => d.match_id === match.id);
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
      // Sprint #7 Phase 7.4 — override Pro Demo Render flow. Quando
      // targetSteamid/targetName presentes (vindos de /demo/[sha]/render),
      // user logado pode estar renderizando perspective de OUTRO player
      // (ex: NiKo). Override session pra que HLAE camera lock + scorer
      // filtrem pelo target, não pelo logged user.
      const effectiveSteamid = targetSteamid || user?.steamid || undefined;
      const inGameName = targetName || match.player_name || user?.name || undefined;
      // Round 4c Fase 1.6 (Bug PC test 26/04): full ReelProps payload
      // pro Remotion compositor. Sem isso, hlae_runner passa base_props={}
      // → composition cai em defaultProps (MOCK_REEL_PROPS = Dust2/mathieu
      // mock) → MP4 vem com dados errados apesar do pipeline OK. Schema
      // deve bater com editor/src/types.ts ReelProps.
      const selectedRanks = selectedHighlights.map((h) => h.rank);
      const reelProps = {
        match,                                              // full MatchOut do server
        selectedRanks,                                      // user's selection
        mood,                                               // user's mood pick
        playerName: inGameName ?? "Player",                 // in-game name (preferred over Steam display)
        orientation: orientation as "vertical" | "horizontal",
        musicEnabled,                                       // Fase 1.17 toggle
        scoreboardEnabled,                                  // Fase 1.27 toggle
        killFlashEnabled,                                   // Sprint #6.1 toggle
        bombTimerEnabled,                                   // Sprint #6.2 toggle
        trackVariantIndex,                                  // Sprint #6.4 picker
      };
      try {
        await startLocalRender({
          demo_path: localDemo.demo_path,
          segments,
          user_steamid64: effectiveSteamid,
          user_player_name: inGameName,
          reel_props: reelProps,
          // Round 4c Fase 1.21 — x-ray opt-in (capture-side cvar).
          show_xray: xrayEnabled,
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
            {/* Comments preserved internally; user-facing copy só fala
                claro sobre temporário vs final + atualiza pros números
                de 720p (Sprint J.6). Antes vazou comentário "Round 4d 2.2
                (Mathieu 29/04)..." direto pro UI — bug feio. Nunca mais. */}
            <div style={{ fontSize: 28, marginBottom: 12 }}>💾</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
              Precisa de mais espaço em disco
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, marginBottom: 14 }}>
              Durante o render, o FragReel guarda arquivos temporários no drive do CS2.
              Eles somem automaticamente assim que o vídeo final é gerado — você
              fica só com o MP4.
            </p>

            {/* Temporário vs final lado a lado — números atualizados pra 720p (Sprint J.6) */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 16,
            }}>
              <div style={{
                padding: "12px 14px",
                background: "rgba(255,107,53,0.08)",
                border: "1px solid rgba(255,107,53,0.25)",
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Durante a captura
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#FF6B35", marginBottom: 4 }}>
                  ~10-30 GB
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
                  Frames temporários — apagados automaticamente
                </div>
              </div>
              <div style={{
                padding: "12px 14px",
                background: "rgba(76,175,130,0.08)",
                border: "1px solid rgba(76,175,130,0.30)",
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Vídeo final
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#4CAF82", marginBottom: 4 }}>
                  ~30-40 MB
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
                  É só esse arquivo que sobra no seu disco
                </div>
              </div>
            </div>

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
                      Precisa de <b style={{ color: "#FF6B35" }}>{issue.needed_gb.toFixed(1)} GB</b> temporários,
                      mas só tem <b style={{ color: "#ffb088" }}>{issue.free_gb.toFixed(1)} GB</b> livres.
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, marginBottom: 20 }}>
              <b style={{ color: "rgba(255,255,255,0.75)" }}>Como liberar:</b> apagar 1-2
              jogos pesados costuma resolver, ou selecionar menos cenas pra render
              (cada cena pesa ~3 GB temporários). Suporte a salvar em drive externo
              está vindo.
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
            <div style={{ color: "#FF6B35", fontWeight: 600, marginTop: 2 }}>
              {selectedCount}/{maxScenes} cena{maxScenes !== 1 ? "s" : ""} selecionada{selectedCount !== 1 ? "s" : ""}
            </div>
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

                  {/* v0.3.1 (Sprint A1) — Badge proeminente substitui thumbnail.
                      Mathieu feedback 25/04: thumbnails prometiam vídeo que não
                      existia (demo só vira video após render). Substituído por
                      badge da jogada principal (Ace > Clutch > Defuse > Plant >
                      Multikill > RWK > HS > Solo) + duração no canto.
                      Mantém clip_url path: SE vídeo existir (caso futuro pós-render),
                      mostra preview; senão badge contextual. */}
                  <div style={{ width: 142, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, position: "relative", background: heroBadgeBg(h), border: on ? `1px solid ${heroBadgeAccent(h)}` : `1px solid ${heroBadgeBorder(h)}` }}>
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
                        {/* Map name no canto top — discreto, contexto */}
                        <div style={{ position: "absolute", top: 6, left: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{match.map.replace("de_","")}</div>
                        {/* HERO badge — icon + tag dominante centralized */}
                        {(() => {
                          const hero = heroBadgeFor(h);
                          return (
                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: hero.fg, padding: "8px 4px 14px" }}>
                              <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 2 }}>{hero.icon}</div>
                              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.1 }}>{hero.label}</div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                    {/* Duração no canto bottom-right (preserved from thumbnail design) */}
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
                    {/* v0.3.1 (Sprint A4) — narrative PT-BR ao lado das tags.
                        Aparece abaixo dos kill chips, em texto secundário pra
                        casual users entenderem sem decorar jargão das tags em
                        inglês. Null em demos legacy parseadas pré-v0.3.1 →
                        omitido (graceful degradation). */}
                    {h.narrative && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: "rgba(255,255,255,0.65)",
                        fontStyle: "italic",
                      }}>
                        {h.narrative}
                      </div>
                    )}
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
                      title={`Até ${f.maxScenes} cenas — mais cenas = mais tempo de render`}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        color: "rgba(255,107,53,0.85)",
                        padding: "4px 10px",
                        background: "rgba(255,107,53,0.08)",
                        border: "1px solid rgba(255,107,53,0.25)",
                        borderRadius: 6,
                        display: "inline-flex", alignItems: "center", gap: 5,
                        alignSelf: "flex-start",
                      }}
                    >
                      🎞 Até {f.maxScenes} cenas
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mood selector — só reel agora (recap dropado em Decisão #1).
             Card é só estatística, sem trilha. */}
        {format === "reel" && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Escolha a trilha</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
              A música sincroniza com os cortes do vídeo. Todas royalty-free.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {MOODS.map((m) => {
                const active = mood === m.id;
                const dimmed = !musicEnabled;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMood(m.id);
                      // Sprint #6.4 — reset variant ao trocar mood pra
                      // evitar índice fora do range de tracks do novo mood.
                      setTrackVariantIndex(0);
                    }}
                    disabled={dimmed}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: active ? `2px solid ${m.color}` : "1px solid #2D2D44",
                      background: active ? `${m.color}12` : "#16213E",
                      cursor: dimmed ? "not-allowed" : "pointer",
                      textAlign: "left",
                      position: "relative",
                      transition: "border-color 0.15s, background 0.15s, opacity 0.15s",
                      opacity: dimmed ? 0.35 : 1,
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

            {/* Sprint #6.4 — variant picker. Só aparece quando mood tem >1
                track e música está habilitada. Layout: linha de pills
                horizontal abaixo do mood grid. */}
            {musicEnabled && MOOD_VARIANTS[mood] && MOOD_VARIANTS[mood].length > 1 && (
              <div style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#16213E",
                border: "1px solid #2D2D44",
                borderRadius: 10,
              }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}>
                  Variante da trilha
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {MOOD_VARIANTS[mood].map((v, idx) => {
                    const isActive = trackVariantIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTrackVariantIndex(idx)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 999,
                          border: isActive ? `1px solid ${MOODS.find((m) => m.id === mood)?.color || "#FF6B35"}` : "1px solid #2D2D44",
                          background: isActive ? `${MOODS.find((m) => m.id === mood)?.color || "#FF6B35"}1F` : "transparent",
                          color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Round 4c Fase 1.17 — toggle música. Game audio (tiros/passos/voice)
                sempre presente (não-toggleable per Mathieu spec). Só a trilha mood
                que é opt-out. UI: row compacto abaixo do grid de moods com switch. */}
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#16213E",
                border: "1px solid #2D2D44",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8E8F0", marginBottom: 2 }}>
                  {musicEnabled ? "🎵 Música de fundo ativa" : "🔇 Sem música"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {musicEnabled
                    ? "Trilha toca por baixo do som do jogo (tiros/passos/voz sempre presentes)."
                    : "Só áudio do jogo (tiros/passos/voz). Use pra postar onde a música pode dar copyright strike."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMusicEnabled((v) => !v)}
                aria-pressed={musicEnabled}
                aria-label="Alternar música de fundo"
                style={{
                  position: "relative",
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  border: "none",
                  background: musicEnabled ? "#FF6B35" : "#2D2D44",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    left: musicEnabled ? 25 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 0.15s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>

            {/* Round 4c Fase 1.21 — toggle x-ray (silhuetas glow dos
                players através de paredes em spec mode CS2). Default OFF
                pq cinematicamente distrai do POV gameplay. User opt-in
                pra estilo "wallhack reveal" mais espetacular. Mesmo
                pattern do music toggle pra consistência UX. */}
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#16213E",
                border: "1px solid #2D2D44",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8E8F0", marginBottom: 2 }}>
                  {xrayEnabled ? "👁 X-ray ativo" : "👁‍🗨 Sem X-ray"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {xrayEnabled
                    ? "Silhuetas dos players aparecem através das paredes (estilo wallhack reveal)."
                    : "Sem silhuetas — gameplay POV puro, sem revelar posições inimigas."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setXrayEnabled((v) => !v)}
                aria-pressed={xrayEnabled}
                aria-label="Alternar x-ray"
                style={{
                  position: "relative",
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  border: "none",
                  background: xrayEnabled ? "#a78bfa" : "#2D2D44",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    left: xrayEnabled ? 25 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 0.15s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>

            {/* Round 4c Fase 1.27 — toggle scoreboard top-left (CT/T alive
                count + HP em tempo real, estilo placar HLTV/CS HUD). Default
                ON pq ajuda viewer entender contexto tático. User pode opt-out
                pra estilo "puro POV sem HUD overlays". Mesmo pattern UX. */}
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#16213E",
                border: "1px solid #2D2D44",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8E8F0", marginBottom: 2 }}>
                  {scoreboardEnabled ? "🎯 Placar tático visível" : "🚫 Sem placar"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {scoreboardEnabled
                    ? "Mostra CT/T vivos + HP do player no canto superior esquerdo, atualizando em tempo real."
                    : "Sem placar — gameplay POV puro. Mostra apenas contagem total de kills do highlight."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScoreboardEnabled((v) => !v)}
                aria-pressed={scoreboardEnabled}
                aria-label="Alternar placar tático"
                style={{
                  position: "relative",
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  border: "none",
                  background: scoreboardEnabled ? "#4CAF82" : "#2D2D44",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    left: scoreboardEnabled ? 25 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 0.15s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>

            {/* Sprint Aesthetic (06/05) — "Estilos visuais" RE-HABILITADO.
                Scorer agora identifica kills bonitas via aesthetic_score
                + aesthetic_style (noscope, knife, wallbang, smoke, blind,
                flick). Editor aplica flash COR-ESPECÍFICA por style.
                Kills comuns ficam sem efeito (anti-fadiga). Default OFF
                até calibração validar distribuição. */}
            <div style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 10,
              background: "#16213E",
              border: "1px solid #2D2D44",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8E8F0", marginBottom: 2 }}>
                  {killFlashEnabled ? "✨ Estilos visuais ativos" : "✨ Estilos visuais"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {killFlashEnabled
                    ? "Flash colorido aplicado só nas kills mais bonitas — noscope (dourado), knife (quente), wallbang (branco), smoke (azul), blind (branco)."
                    : "Aplica efeito visual cinematic só nas kills esteticamente mais bonitas (noscope, knife, wallbang, etc). Kills comuns ficam sem efeito."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKillFlashEnabled((v) => !v)}
                aria-pressed={killFlashEnabled}
                aria-label="Alternar estilos visuais nas kills bonitas"
                style={{
                  position: "relative",
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  border: "none",
                  background: killFlashEnabled ? "#FFD700" : "#2D2D44",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 3,
                  left: killFlashEnabled ? 25 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "white",
                  transition: "left 0.15s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>

            {/* Sprint #6.2 — Bomb timer red bar toggle. Default OFF.
                Aparece só em rounds com plant_won (CS2 fuse 40s). */}
            <div style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 10,
              background: "#16213E",
              border: "1px solid #2D2D44",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8E8F0", marginBottom: 2 }}>
                  {bombTimerEnabled ? "💣 Bomb timer ativo" : "🚫 Sem bomb timer"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {bombTimerEnabled
                    ? "Barra vermelha topo do vídeo decrescendo 40s pós-plant — estilo broadcast Major."
                    : "Sem timer da bomba. Highlights com plant continuam mostrando notif nativa CS2."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBombTimerEnabled((v) => !v)}
                aria-pressed={bombTimerEnabled}
                aria-label="Alternar bomb timer"
                style={{
                  position: "relative",
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  border: "none",
                  background: bombTimerEnabled ? "#FF3B30" : "#2D2D44",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 3,
                  left: bombTimerEnabled ? 25 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "white",
                  transition: "left 0.15s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>
          </div>
        )}

        {/* Orientation selector — vertical (mobile) ou horizontal (desktop).
             Reel-only desde Decisão #1 — card e recap removidos. */}
        {format === "reel" && (
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
              {selectedCount > 0 ? (
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
