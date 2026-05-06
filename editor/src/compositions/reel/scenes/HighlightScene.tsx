import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  theme,
  MOODS,
  killTimeInSceneSec,
  s2f,
  HIGHLIGHT_VIDEO_SKIP_SEC,
  FPS,
  effectiveSkipSec,
  effectiveSkipSecSmart,
  effectiveTailSkipSec,
  effectiveSceneEndSec,
  refStartSec,
  refSourceDurSec,
  resolveAliveAt,
} from "../../../theme";
import { Highlight, Kill } from "../../../types";

type Props = {
  highlight: Highlight;
  mood: keyof typeof MOODS;
  index: number; // 0, 1, 2... para variação de estilo
  // Round 4c Fase 1.27 — toggle scoreboard (default true). User opt-out
  // via UI no match-page. Quando false, badge só mostra `#N` rank.
  showScoreboard?: boolean;
  // Sprint #6.1 (05/05) — flash branco + scale pulse no momento de cada kill.
  killFlashEnabled?: boolean;
  // Sprint #6.2 (05/05) — bomb timer red bar topo (40s plant→explosion).
  bombTimerEnabled?: boolean;
};

/**
 * HighlightScene — duração variável (clampada em REEL_BOUNDS / RECAP_BOUNDS).
 *
 * Camadas (de trás pra frente):
 *   1. Gameplay backdrop — <OffthreadVideo> com .mov ProRes do hlae_runner.py,
 *      OU gradient placeholder + crosshair fake (dev no Mac sem footage).
 *   2. Scanlines, flash de impacto, gradient overlays (linguagem visual).
 *   3. Rank badge, label, kill feed (HUD overlays).
 */
export const HighlightScene: React.FC<Props> = ({
  highlight,
  mood,
  index,
  showScoreboard = true,
  killFlashEnabled = false,
  bombTimerEnabled = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const moodDef = MOODS[mood];
  const isHorizontal = width > height;

  // Duração da cena em segundos — usado pra calcular timing das kills.
  const sceneDurationSec = durationInFrames / fps;

  // Source preferido: gameplayVideoSrc (HLAE/ProRes do PC) > clip_url (legado
  // do screen capture do Round 3) > null (cai no placeholder gradient).
  const gameplaySrc = highlight.gameplayVideoSrc ?? highlight.clip_url ?? null;

  // playbackRate: spec produto v0.3.1 (Mathieu confirmou) é real-time
  // SEMPRE — sem time-lapse/fast cuts. Round 4c Fase 1.10 bumpou
  // REEL_HIGHLIGHT_BOUNDS.max pra 35s, então scene = source - SKIP quase
  // sempre. Calculamos rate defensive: se algum dia source - SKIP estourar
  // o max, dá leve fast-forward em vez de overflow visual.
  //
  // Round 4c Fase 1.18 BUG FIX (Mathieu reportou "cena trava antes de
  // passar pra próxima"): o cálculo antigo usava `sourceDurSec / sceneDur`,
  // mas com OffthreadVideo startFrom = SKIP, o vídeo só tem
  // `(sourceDurSec - SKIP)` segundos PLAYABLES. Quando rate < 1.0 (ou
  // = 1.0 mas scene > availableVideo), OffthreadVideo termina antes da
  // Sequence acabar → último frame congela = "cena trava". Fix: usar
  // availableVideoSec no numerator. Caso comum (sourceDur=30s SKIP=2):
  // available=28s, scene=28s, rate=1.0. SEM freeze.
  // Round 4c Fase 1.28 — sourceDur mov-aware (refSourceDurSec) consistente
  // com HighlightsReel.highlightDurationSec. Quando hlae_runner popula
  // gameplayStartSec (cluster window start), refStart = mov first frame,
  // sourceDur = mov approx duration. Senão fallback round-based.
  const sourceDurSec = refSourceDurSec(highlight);
  // 05/05 — Round 4d 3.5 V3 — smart skip pra plant/defuse não cortarem.
  // Quando scene natural > REEL_BOUNDS.max, smart skip aumenta o front
  // pra fit max, preservando events no END. Vide theme.ts.
  const sceneSkipSec = effectiveSkipSecSmart(highlight);
  const sceneEndInSourceSec = effectiveSceneEndSec(highlight);
  const availableVideoSec = Math.max(0.1, sceneEndInSourceSec - sceneSkipSec);
  const gameplayRate = availableVideoSec / sceneDurationSec;

  // Round 4c Fase 1.27 — scoreboard ao vivo via alive_timeline.
  // sceneTime → demoTime (highlight.start + sceneTime - sceneSkip já passou)
  // Wait: gameplay no Remotion roda real-time, mas startFrom pula sceneSkipSec
  // do .mov. Então sceneTime no Remotion = (sceneTime + sceneSkip) no source
  // de gameplay = (highlight.start + sceneSkip + sceneTime) em demo time.
  // Pra timeline events (que estão em demo time), demoTimeSec é essa soma.
  const sceneTimeSec = frame / fps;
  // Fase 1.28 — demoTime calc usa refStart (gameplayStartSec quando
  // available, senão highlight.start) consistente com killTimeInSceneSec.
  const demoTimeSec = refStartSec(highlight) + sceneSkipSec + sceneTimeSec;

  // Round 4c Fase 1.27 — alive count via timeline completa (todas deaths).
  // Fallback pro Fase 1.23 (kill-only) quando timeline não disponível.
  const aliveResolved = resolveAliveAt(highlight, demoTimeSec);

  // HP do user — ainda baseado em última kill completada (não temos
  // timeline de HP per tick no parser). Mostra HP do último kill.attacker_health
  // disponível em sceneTime atual.
  const killTimings = highlight.kills.map((k, i) => ({
    kill: k,
    sceneTime: killTimeInSceneSec(
      k,
      i,
      highlight.kills.length,
      highlight.start,
      sceneDurationSec,
      sceneSkipSec,
      highlight.gameplayStartSec,
      // Round 4d 3.3 — passa playbackRate pra alinhar killfeed com video
      // acelerado (caso 3.1 cluster grande). Quando rate=1.0 (caso normal),
      // não muda nada. Quando rate>1, kill aparece NO MOMENTO VISUAL.
      gameplayRate
    ),
  }));
  const completedKills = killTimings.filter((e) => e.sceneTime <= sceneTimeSec);
  const lastKill = completedKills.length > 0
    ? completedKills[completedKills.length - 1].kill
    : null;

  const hasScoreboardContext = aliveResolved.hasTimeline;
  const dynamicAliveCt = aliveResolved.alive_ct;
  const dynamicAliveT = aliveResolved.alive_t;
  const dynamicHp = lastKill?.attacker_health ?? null;

  // Flash branco no frame 0 (impacto inicial da scene)
  const flash = interpolate(frame, [0, 4, 8], [1, 0.3, 0], {
    extrapolateRight: "clamp",
  });

  // Sprint Aesthetic V2 (06/05) — Visual styles CINEMATIC, não flash.
  //
  // Mathieu spec round 2: "as flashes tão parecendo muito flashes do
  // próprio jogo, como se o adversário tivesse jogado flashes". Flash
  // branco/colorido full-screen confunde com flashbang in-game. Substituí
  // por combo CLEARLY editorial:
  //   1. Style LABEL popup centro ("NO SCOPE", "WALLBANG", etc) com
  //      pop-in scale + fade (~700ms). Major-style highlight callout.
  //   2. VIGNETTE pulse colorido (escurecido nos cantos, focus ao centro)
  //      — não wash, é darken seletivo.
  //   3. BORDER accent (corner brackets) na cor do estilo, pulse breve.
  //   4. Slow-mo opcional: kills com style ganham playbackRate dip via
  //      Sequence externa (HighlightsReel layer level).
  //
  // Nenhum elemento É flash branco full-screen → não confunde com gameplay.
  //
  // Threshold é gerenciado pelo scorer (aesthetic_score >= threshold seta
  // style). Editor é dumb consumer — só renderiza o que vier.
  const STYLE_COLORS: Record<string, string> = {
    noscope:  "#FFD700", // dourado
    knife:    "#FF8C3C", // laranja quente
    wallbang: "#E8E8FF", // branco azulado x-ray
    smoke:    "#78B4FF", // azul claro
    blind:    "#FFFFFF", // branco
    flick:    "#FF6B35", // laranja FragReel
  };

  const STYLE_LABELS: Record<string, string> = {
    noscope:  "NO SCOPE",
    knife:    "BACKSTAB",
    wallbang: "WALLBANG",
    smoke:    "THROUGH SMOKE",
    blind:    "BLIND KILL",
    flick:    "ONE TAP",
  };

  /** Find the active styled kill near current frame (within effect window).
   *  Returns the kill + style + frame-delta pra computar progress. */
  type ActiveStyleEvent = {
    style: string;
    label: string;
    color: string;
    delta: number; // frames since kill moment (0 = exact kill frame)
    progress: number; // 0..1 normalized within effect window (40 frames ~1.3s)
  };
  let activeStyle: ActiveStyleEvent | null = null;
  if (killFlashEnabled) {
    const EFFECT_WINDOW_FRAMES = 40; // 1.33s @ 30fps total cinematic window
    const PRE_FRAMES = 4; // 0.13s antes da kill: label começa a aparecer
    for (const t of killTimings) {
      const style = (t.kill as Kill).aesthetic_style;
      if (!style) continue;
      const kFrame = s2f(t.sceneTime);
      const delta = frame - kFrame;
      if (delta < -PRE_FRAMES || delta > EFFECT_WINDOW_FRAMES) continue;
      // Mais perto da kill = mais "ativo" (pra escolher entre overlapping)
      if (activeStyle === null || Math.abs(delta) < Math.abs(activeStyle.delta)) {
        const progress = (delta + PRE_FRAMES) / (EFFECT_WINDOW_FRAMES + PRE_FRAMES);
        activeStyle = {
          style,
          label: STYLE_LABELS[style] ?? "HIGHLIGHT",
          color: STYLE_COLORS[style] ?? STYLE_COLORS.flick,
          delta,
          progress: Math.max(0, Math.min(1, progress)),
        };
      }
    }
  }

  // Vignette intensity: peak at kill moment, decay smoothly
  const vignetteIntensity = activeStyle
    ? interpolate(
        activeStyle.delta,
        [-4, 0, 8, 30],
        [0, 0.85, 0.55, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  // Sprint #6.5 (06/05) — POV vítima window detection.
  // Quando captura emite spec_player switch durante kill_tick±window, o
  // gameplay video MUDA pra POV vítima. Editor não controla a câmera, mas
  // ADICIONA overlay editorial pra signalizar "POV VÍTIMA" — user entende
  // que o cut é intencional, não bug.
  // Janela: [-0.5s, +0.3s] em torno da kill com pov_eligible. Match capture
  // window de capture_script.py POV_PRE_TICKS=32, POST=19 @ 64tps.
  const POV_PRE_SEC = 0.5;
  const POV_POST_SEC = 0.3;
  let povActive: { delta: number; victimName: string } | null = null;
  for (const t of killTimings) {
    const k = t.kill as Kill;
    if (!k.pov_eligible || !k.victim_name) continue;
    const kFrame = s2f(t.sceneTime);
    const delta = (frame - kFrame) / FPS; // segundos relativos à kill
    if (delta >= -POV_PRE_SEC && delta <= POV_POST_SEC) {
      if (povActive === null || Math.abs(delta) < Math.abs(povActive.delta)) {
        povActive = { delta, victimName: k.victim_name };
      }
    }
  }
  // POV badge progress: fade in nos primeiros 100ms da janela, fade out
  // nos últimos 100ms.
  const povBadgeOpacity = povActive
    ? interpolate(
        povActive.delta,
        [-POV_PRE_SEC, -POV_PRE_SEC + 0.1, POV_POST_SEC - 0.1, POV_POST_SEC],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  // Label popup: spring-style scale + fade
  const labelOpacity = activeStyle
    ? interpolate(activeStyle.delta, [-4, 0, 20, 36], [0, 1, 1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 0;
  const labelScale = activeStyle
    ? interpolate(activeStyle.delta, [-4, 0, 4, 36], [0.6, 1.15, 1.0, 1.0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 1;

  // Border accent: pulse na kill, fade out
  const borderIntensity = activeStyle
    ? interpolate(activeStyle.delta, [-2, 0, 12, 28], [0, 1, 0.6, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 0;

  // Sprint #6.2 — Bomb timer red bar (Major-style). CS2 bomb explode 40s
  // pós-plant. Mostra barra decrescendo do plant até explosion ou defuse.
  //
  // Sprint #6.2.1 BUG FIX (Mathieu 05/05): timer não aparecia em defuse rounds.
  // Causa: versão original usava bomb_action_timestamp como plant tick, mas em
  // defuse rounds esse field é o DEFUSE tick (não plant). Backend agora popula
  // bomb_planted_timestamp INDEPENDENTE de quem plantou. Editor usa esse field.
  // Backwards-compat: fallback pra bomb_action_timestamp quando highlight é
  // legacy (pré-Sprint #6.2.1) E bomb_action="plant_won" (mesma semântica).
  const BOMB_FUSE_TIME_SEC = 40.0;
  const plantTimestamp =
    typeof highlight.bomb_planted_timestamp === "number"
      ? highlight.bomb_planted_timestamp
      : highlight.bomb_action === "plant_won" &&
        typeof highlight.bomb_action_timestamp === "number"
      ? highlight.bomb_action_timestamp
      : null;
  const showBombBar = bombTimerEnabled && plantTimestamp !== null;
  // Plant time relative to scene
  const plantSceneTime = showBombBar
    ? (plantTimestamp! - refStartSec(highlight) - sceneSkipSec) / Math.max(0.01, gameplayRate)
    : -1;
  const sceneTimeNow = frame / fps;
  // Fraction remaining (1.0 at plant → 0.0 at 40s post-plant). Bar disappears
  // before plant happens (sceneTime < plantSceneTime) AND after explosion.
  const bombFraction = showBombBar
    ? Math.max(0, Math.min(1, 1 - (sceneTimeNow - plantSceneTime) / BOMB_FUSE_TIME_SEC))
    : 0;
  const bombSecondsLeft = Math.max(0, BOMB_FUSE_TIME_SEC * bombFraction);
  const bombBarVisible = showBombBar && sceneTimeNow >= plantSceneTime && bombFraction > 0;

  // Rank badge (#1, #2, #3) entra com spring
  const rankSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 12, mass: 0.6 },
  });

  // Label cai de cima
  const labelSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  // Round 4c Fase 1.29 (fadeOut 0.4s pra mudança clara entre rounds).
  // Round 4c Fase 1.31 (Mathieu reportou "transições entre cortes não
  // estão implantadas em todos os cortes"): adicionado fadeIn simétrico
  // nos primeiros 12 frames. Antes só fadeOut da cena anterior — cena
  // nova entrava com opacity=1 abrupto. Quando cena anterior tinha
  // fadeOut visível, perception era "fadeOut → CUT abrupto". Agora
  // fadeIn(0→1) na nova cena complementa fadeOut(1→0) da anterior:
  // transição smooth em CADA corte (no SCENE boundary, não só no fim).
  const fadeIn = interpolate(
    frame,
    [0, 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  // Composto — opacity = fadeIn * fadeOut. No início: 0→1. No meio: 1.
  // No fim: 1→0. Transição visualmente simétrica.
  const sceneOpacity = fadeIn * fadeOut;

  // Parallax zoom no fundo (efeito dolly in)
  const zoom = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.08]
  );

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, background: theme.bg }}>
      {/* Camada 1 — Gameplay backdrop.
          Quando tem .mov do HLAE, OffthreadVideo (cobre frame inteiro,
          object-fit cover pra horizontal/vertical não quebrarem). Sem footage,
          gradient + crosshair fake — dev no Mac fica funcional. */}
      {gameplaySrc ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <OffthreadVideo
            src={gameplaySrc}
            playbackRate={gameplayRate}
            // Round 4c Fase 1.19 — startFrom usa effectiveSkipSec (não a
            // constante raw) pra ser consistente com scene duration calc
            // em HighlightsReel. Pra clusters muito curtos, skip diminui
            // automaticamente. Pra cluster comum (PAD_PRE 7s), pula 4s
            // de buy phase + walk pré-engagement → highlight começa em
            // "peek/posicionamento já no engagement". Mathieu Fase 1.19
            // re-cobrou: "transições travadas, principalmente depois do
            // primeiro round" — análise frames PC mostrou ~5s de player
            // com knife andando entre #1→#2. SKIP=4 corta isso.
            startFrom={Math.round(sceneSkipSec * FPS)}
            // v0.3.1 Round 4c Fase 1.10 (Mathieu spec): som do jogo SEMPRE
            // presente (tiros, footsteps, voice, defuse beep, plant beep).
            // Antes muted=true descartava todo audio do .mov ProRes capturado
            // pelo HLAE. Agora volume=0.85 dá game audio no foreground sem
            // soterrar a música de fundo (Audio component da composition raiz
            // tá em volume=0.65). Mix tunado pra game ≥ música, mas música
            // audível.
            volume={0.85}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background: `
              radial-gradient(circle at 30% 40%, ${moodDef.color}30 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, ${theme.orange}20 0%, transparent 50%),
              linear-gradient(135deg, #0a0a15 0%, #1a1a2e 100%)
            `,
            transform: `scale(${zoom})`,
          }}
        >
          {/* Crosshair fake (placeholder) — só aparece quando NÃO tem footage real.
              CS2 já tem seu próprio crosshair, mostrar dois fica feio. */}
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                position: "relative",
                opacity: 0.35,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  width: 2,
                  height: 14,
                  background: moodDef.color,
                  transform: "translateX(-50%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 0,
                  width: 2,
                  height: 14,
                  background: moodDef.color,
                  transform: "translateX(-50%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  width: 14,
                  height: 2,
                  background: moodDef.color,
                  transform: "translateY(-50%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 0,
                  width: 14,
                  height: 2,
                  background: moodDef.color,
                  transform: "translateY(-50%)",
                }}
              />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* Scanlines — sempre, dão consistência visual de fragmovie.
          Sutis (rgba 0.02) pra não competir com o gameplay quando ele existe. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 4px)",
          pointerEvents: "none",
        }}
      />

      {/* Round 4c Fase 1.20 — crosshair sintético sempre on (Mathieu pediu
          "se der, seria legal manter o crosshair no vídeo"). Necessário pq
          (a) cl_drawhud 0 + crosshair 1 desliga crosshair quando arma é
          knife (CS2 design — knife é melee sem aim indicator); (b) viewer
          mobile perde indicador de aim center em frames com knife/granade.
          Overlay vive AQUI (depois do gameplay/placeholder, antes do flash
          e overlays HUD) — sempre visível sobre qualquer footage. Tamanho
          + opacidade tunados pra ser indicador discreto, não competir
          visualmente com o crosshair real do CS2 quando ele aparece. */}
      {gameplaySrc && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              width: isHorizontal ? 18 : 22,
              height: isHorizontal ? 18 : 22,
              opacity: 0.55,
            }}
          >
            {/* Vertical bar (top) */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                width: 2,
                height: 7,
                background: "white",
                transform: "translateX(-50%)",
                boxShadow: "0 0 4px rgba(0,0,0,0.6)",
              }}
            />
            {/* Vertical bar (bottom) */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 0,
                width: 2,
                height: 7,
                background: "white",
                transform: "translateX(-50%)",
                boxShadow: "0 0 4px rgba(0,0,0,0.6)",
              }}
            />
            {/* Horizontal bar (left) */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                width: 7,
                height: 2,
                background: "white",
                transform: "translateY(-50%)",
                boxShadow: "0 0 4px rgba(0,0,0,0.6)",
              }}
            />
            {/* Horizontal bar (right) */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                right: 0,
                width: 7,
                height: 2,
                background: "white",
                transform: "translateY(-50%)",
                boxShadow: "0 0 4px rgba(0,0,0,0.6)",
              }}
            />
            {/* Center dot */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 2,
                height: 2,
                background: "white",
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 4px rgba(0,0,0,0.6)",
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      {/* Flash de impacto inicial (frame 0 da cena) */}
      <AbsoluteFill
        style={{
          background: "white",
          opacity: flash,
          pointerEvents: "none",
        }}
      />

      {/* Sprint Aesthetic V2 (06/05) — Visual styles CINEMATIC.
          3 layers per styled kill, NÃO flash branco (que confundia com
          flashbang in-game per Mathieu spec):
            (a) VIGNETTE pulse: darken nos cantos com tinta da cor do style,
                gradient transparent no centro → mantém visual do gameplay
                claro mas FOCA atenção. Visualmente é "câmera fechando".
            (b) BORDER ACCENT corners: 4 cantos com bracket grosso em cor
                do style, pulse na kill, fade out.
            (c) LABEL POPUP center: texto "NO SCOPE", "WALLBANG", etc com
                scale+fade entrance, persistente ~700ms, fade out.
          Kills sem style: NADA renderizado (anti-fadiga). */}
      {activeStyle && vignetteIntensity > 0.01 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 30%, ${activeStyle.color}88 90%)`,
            opacity: vignetteIntensity,
            pointerEvents: "none",
            mixBlendMode: "multiply",
          }}
        />
      )}
      {activeStyle && borderIntensity > 0.01 && (
        <AbsoluteFill style={{ pointerEvents: "none", opacity: borderIntensity }}>
          {/* 4 corner brackets — top-left, top-right, bottom-left, bottom-right */}
          {[
            { top: 24, left: 24, borderTop: 4, borderLeft: 4 },
            { top: 24, right: 24, borderTop: 4, borderRight: 4 },
            { bottom: 24, left: 24, borderBottom: 4, borderLeft: 4 },
            { bottom: 24, right: 24, borderBottom: 4, borderRight: 4 },
          ].map((pos, i) => {
            const { borderTop, borderLeft, borderRight, borderBottom, ...positioning } = pos;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  ...positioning,
                  width: 80,
                  height: 80,
                  borderColor: activeStyle.color,
                  borderStyle: "solid",
                  borderWidth: 0,
                  borderTopWidth: borderTop ?? 0,
                  borderLeftWidth: borderLeft ?? 0,
                  borderRightWidth: borderRight ?? 0,
                  borderBottomWidth: borderBottom ?? 0,
                  boxShadow: `0 0 24px ${activeStyle.color}`,
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}
      {activeStyle && labelOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              transform: `scale(${labelScale})`,
              opacity: labelOpacity,
              padding: "14px 32px",
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
              border: `2px solid ${activeStyle.color}`,
              borderRadius: 12,
              fontSize: isHorizontal ? 42 : 56,
              fontWeight: 900,
              letterSpacing: "0.18em",
              color: activeStyle.color,
              fontFamily: theme.fontDisplay,
              textShadow: `0 0 24px ${activeStyle.color}, 0 4px 12px rgba(0,0,0,0.8)`,
              boxShadow: `0 0 40px ${activeStyle.color}80, 0 8px 24px rgba(0,0,0,0.6)`,
              whiteSpace: "nowrap",
            }}
          >
            {activeStyle.label}
          </div>
        </AbsoluteFill>
      )}

      {/* Sprint #6.5 (06/05) — POV VÍTIMA badge overlay.
          Aparece quando capture switched spec_player pra vítima durante a
          janela [-0.5s, +0.3s] em volta de kill.pov_eligible. Visual:
          badge top-center "POV VÍTIMA · <name>" com border vermelho +
          glow + pulse sutil. Sinaliza editorialmente que o cut é
          intencional — sem isso, viewer pensaria que CS2 fez auto-director
          drift. */}
      {povActive && povBadgeOpacity > 0.01 && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              top: isHorizontal ? 80 : 360, // abaixo do scoreboard + bomb timer
              left: "50%",
              transform: "translateX(-50%)",
              padding: "10px 22px",
              background: "rgba(220, 38, 38, 0.18)",
              backdropFilter: "blur(8px)",
              border: "2px solid #DC2626",
              borderRadius: 10,
              fontSize: isHorizontal ? 18 : 22,
              fontWeight: 800,
              letterSpacing: "0.18em",
              color: "#FFE4E4",
              fontFamily: theme.fontDisplay,
              boxShadow: "0 0 28px rgba(220, 38, 38, 0.55), 0 6px 16px rgba(0,0,0,0.5)",
              textShadow: "0 0 14px rgba(220, 38, 38, 0.9), 0 2px 6px rgba(0,0,0,0.8)",
              whiteSpace: "nowrap",
              opacity: povBadgeOpacity,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            POV VÍTIMA · {povActive.victimName.toUpperCase()}
          </div>
        </AbsoluteFill>
      )}

      {/* Gradient overlay top + bottom */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Round 4c Fase 1.29 (Mathieu spec): SCOREBOARD agora MAIOR +
          CENTRALIZADO no topo. Lado esquerdo do topo é onde rede social
          coloca foto/nome do perfil que postou — não competir com isso.
          Top-center é canvas livre, scoreboard ganha protagonismo.
          Plus #N rank badge removido (sem utilidade pro user) — espaço
          reaproveitado pra watermark fragreel.gg no top-left (atrai
          outros users a saber como foi gerado). */}
      {/* Sprint #6.2 — Bomb timer red bar (Major-style).
          06/05 (Mathieu spec após reel Vitality vs GamerLegion):
          "Acho que a barra da bomba pode até ficar abaixo do scoreboard,
          ser um pouco mais grossa, pra chamar um pouco mais de atenção".
          Mudanças:
            - top: 22 → 180 (vertical) / 14 → 95 (horizontal): abaixo do
              scoreboard que tem ~120px altura no vertical (top 60 +
              padding 14+14 + content 56+gap+17 ≈ 120).
            - height: 6 → 14: 2.3× mais grossa, mais protagonismo.
            - barWidth: 600 → 680 (vertical), 520 → 600 (horizontal):
              ligeiramente mais larga pra balancear com altura nova.
            - label fontSize: 11 → 13 BOMB, 14 → 18 timer: proporcional
              à barra.
          Pulse vermelho intensifica nos últimos 5s (mantido). */}
      {bombBarVisible && (() => {
        const isCritical = bombSecondsLeft < 5;
        const pulseAlpha = isCritical
          ? 0.85 + 0.15 * Math.sin((frame * Math.PI) / 6) // 5Hz pulse
          : 1.0;
        const barWidth = isHorizontal ? 600 : 680;
        return (
          <div style={{
            position: "absolute",
            top: isHorizontal ? 95 : 180,
            left: "50%",
            transform: "translateX(-50%)",
            width: barWidth,
            maxWidth: "78%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            pointerEvents: "none",
            zIndex: 5,
            opacity: pulseAlpha,
          }}>
            {/* Timer somente — Mathieu spec (06/05): "timer da bomba também
                está meio amador com o ícone da bomba e escrito bomb. Acho
                que a barra vermelha sozinha com o counter já tá bom".
                Removido 💣 + "BOMB" label. Apenas tempo "0:XX" centralizado
                acima da barra. Cor branco normal, vermelho quando critical
                (<5s). */}
            <div style={{
              fontSize: 18,
              fontWeight: 900,
              color: isCritical ? "#FF3B30" : "white",
              fontVariantNumeric: "tabular-nums",
              textShadow: "0 1px 4px rgba(0,0,0,0.85)",
              fontFamily: theme.fontDisplay,
              letterSpacing: "0.05em",
            }}>
              0:{Math.ceil(bombSecondsLeft).toString().padStart(2, "0")}
            </div>
            {/* Bar — 06/05 bumpada de 6px → 14px pra mais atenção */}
            <div style={{
              width: "100%",
              height: 14,
              borderRadius: 7,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,59,48,0.5)",
              overflow: "hidden",
              boxShadow: "0 3px 10px rgba(0,0,0,0.6)",
            }}>
              <div style={{
                width: `${bombFraction * 100}%`,
                height: "100%",
                background: isCritical
                  ? "linear-gradient(90deg, #FF3B30 0%, #FF6B35 100%)"
                  : "linear-gradient(90deg, #C82018 0%, #FF3B30 100%)",
                transition: "width 0.05s linear",
                boxShadow: isCritical ? "0 0 12px rgba(255,59,48,0.85)" : "none",
              }} />
            </div>
          </div>
        );
      })()}

      {showScoreboard && hasScoreboardContext && (
        <div
          style={{
            position: "absolute",
            top: isHorizontal ? 32 : 60,
            left: "50%",
            transform: `translateX(-50%) scale(${rankSpring})`,
            opacity: rankSpring,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "center",
          }}
        >
          {/* Card scoreboard — MAIOR (Fase 1.29). Mathieu pediu "ficar
              maior". Padding + fontSize bumped. CT/T cells now 90+px. */}
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              background: "rgba(0,0,0,0.82)",
              backdropFilter: "blur(10px)",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
            }}
          >
            {/* CT cell */}
            <div
              style={{
                background: "rgba(96, 165, 250, 0.18)",
                padding: isHorizontal ? "10px 24px" : "14px 30px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minWidth: isHorizontal ? 80 : 100,
              }}
            >
              <div
                style={{
                  fontSize: isHorizontal ? 14 : 17,
                  fontWeight: 800,
                  color: "#60a5fa",
                  letterSpacing: "0.2em",
                  fontFamily: theme.fontDisplay,
                  lineHeight: 1,
                }}
              >
                CT
              </div>
              <div
                style={{
                  fontSize: isHorizontal ? 44 : 56,
                  fontWeight: 900,
                  color: theme.text,
                  fontFamily: theme.fontMono,
                  lineHeight: 1,
                }}
              >
                {dynamicAliveCt}
              </div>
            </div>
            {/* Separator */}
            <div
              style={{
                width: 2,
                background: "rgba(255,255,255,0.18)",
              }}
            />
            {/* T cell */}
            <div
              style={{
                background: "rgba(255, 159, 64, 0.18)",
                padding: isHorizontal ? "10px 24px" : "14px 30px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minWidth: isHorizontal ? 80 : 100,
              }}
            >
              <div
                style={{
                  fontSize: isHorizontal ? 14 : 17,
                  fontWeight: 800,
                  color: "#ff9f40",
                  letterSpacing: "0.2em",
                  fontFamily: theme.fontDisplay,
                  lineHeight: 1,
                }}
              >
                T
              </div>
              <div
                style={{
                  fontSize: isHorizontal ? 44 : 56,
                  fontWeight: 900,
                  color: theme.text,
                  fontFamily: theme.fontMono,
                  lineHeight: 1,
                }}
              >
                {dynamicAliveT}
              </div>
            </div>
          </div>

          {/* HP bar — só mostra se temos último HP. MAIOR pra match scoreboard. */}
          {dynamicHp !== null && (
            <div
              style={{
                background: "rgba(0,0,0,0.82)",
                backdropFilter: "blur(10px)",
                borderRadius: 6,
                padding: isHorizontal ? "5px 14px" : "7px 18px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <span
                style={{
                  fontSize: isHorizontal ? 13 : 16,
                  fontWeight: 800,
                  color: dynamicHp < 30 ? "#ff4444" : "#4CAF82",
                  letterSpacing: "0.15em",
                  fontFamily: theme.fontDisplay,
                }}
              >
                HP
              </span>
              <span
                style={{
                  fontSize: isHorizontal ? 22 : 28,
                  fontWeight: 900,
                  color: dynamicHp < 30 ? "#ff4444" : theme.text,
                  fontFamily: theme.fontMono,
                  lineHeight: 1,
                }}
              >
                {dynamicHp}
              </span>
              {/* Mini HP bar visual */}
              <div
                style={{
                  width: isHorizontal ? 70 : 90,
                  height: 6,
                  background: "rgba(255,255,255,0.18)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, dynamicHp))}%`,
                    height: "100%",
                    background: dynamicHp < 30 ? "#ff4444" : "#4CAF82",
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Round 4c Fase 1.29 — fallback "{N} KILLS" quando scoreboard
          OFF (toggle user) ou highlight legado (sem alive_timeline).
          Mantém top-left position pra não conflitar com scoreboard
          centralizado. */}
      {(!showScoreboard || !hasScoreboardContext) && (
        <div
          style={{
            position: "absolute",
            top: isHorizontal ? 40 : 80,
            left: isHorizontal ? 40 : 50,
            transform: `scale(${rankSpring})`,
            opacity: rankSpring,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: isHorizontal ? 28 : 34,
              fontWeight: 900,
              color: theme.text,
              letterSpacing: "-0.02em",
              fontFamily: theme.fontDisplay,
              lineHeight: 1,
            }}
          >
            {highlight.kills.length} {highlight.kills.length === 1 ? "KILL" : "KILLS"}
          </div>
          {highlight.kills.filter((k) => k.headshot).length > 0 && (
            <div
              style={{
                fontSize: isHorizontal ? 14 : 16,
                fontWeight: 800,
                color: moodDef.color,
                letterSpacing: "0.12em",
                fontFamily: theme.fontDisplay,
                lineHeight: 1,
              }}
            >
              {highlight.kills.filter((k) => k.headshot).length} HS
            </div>
          )}
        </div>
      )}

      {/* Round 4c Fase 1.29 (revisão Mathieu): #N badge VOLTA top-left
          como separador visual entre rounds. Combinado com fadeOut
          maior (12 frames, mais visível) marca clearly mudança de
          highlight. Posicionado no canto pra não conflitar com
          scoreboard centralizado top-center. */}
      <div
        style={{
          position: "absolute",
          top: isHorizontal ? 40 : 80,
          left: isHorizontal ? 40 : 50,
          transform: `scale(${rankSpring})`,
          opacity: rankSpring,
          width: isHorizontal ? 72 : 84,
          height: isHorizontal ? 72 : 84,
          borderRadius: 18,
          background: highlight.rank === 1 ? moodDef.color : "#16213E",
          border:
            highlight.rank === 1
              ? "none"
              : `2px solid ${moodDef.color}60`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: isHorizontal ? 36 : 42,
          color: highlight.rank === 1 ? "white" : moodDef.color,
          fontFamily: theme.fontDisplay,
          boxShadow:
            highlight.rank === 1
              ? `0 0 40px ${moodDef.color}80`
              : "none",
        }}
      >
        #{highlight.rank}
      </div>

      {/* Round 4c Fase 1.29 (revisão Mathieu): WATERMARK
          "Vídeo gerado por fragreel.gg" — bottom-right, sutil mas
          legível. Serve como atribuição/CTA pra growth orgânico via
          reels postados em redes sociais.
          Round 4c Fase 1.36 (Mathieu pós-PASS Round 4c): "watermark
          fragreel.gg tem que ser maior do que o estado atual".
          fontSizes bumped ~50%, padding +30%, opacity 0.85→0.92.
          Round 4d 4.1 (Mathieu 29/04, primeiro reel próprio): "watermark
          ainda muito pequena durante o vídeo". Bump adicional ~50%
          (vertical 17/20 → 26/30, horizontal 14/17 → 22/26), padding
          +40%, opacity 0.92→1.0. Watermark é growth channel principal
          (reels postados em redes) — precisa ser legível em mobile feed
          a 50% scale. Regra de negócio universal pra TODOS users
          (rule_user_feedback_is_universal_spec). */}
      <div
        style={{
          position: "absolute",
          bottom: isHorizontal ? 32 : 56,
          right: isHorizontal ? 32 : 40,
          opacity: 1.0,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: isHorizontal ? "10px 20px" : "13px 24px",
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          borderRadius: 9,
          border: `1px solid ${moodDef.color}60`,
        }}
      >
        <span
          style={{
            fontSize: isHorizontal ? 22 : 26,
            fontWeight: 700,
            color: theme.textMuted,
            letterSpacing: "0.05em",
            fontFamily: theme.fontDisplay,
          }}
        >
          Vídeo gerado por
        </span>
        <span
          style={{
            fontSize: isHorizontal ? 26 : 30,
            fontWeight: 900,
            color: moodDef.color,
            letterSpacing: "-0.01em",
            fontFamily: theme.fontDisplay,
          }}
        >
          fragreel.gg
        </span>
      </div>

      {/* Label — bottom (proporcional pra ficar bem em vertical e horizontal) */}
      <div
        style={{
          position: "absolute",
          bottom: isHorizontal ? 80 : 240,
          left: isHorizontal ? 40 : 50,
          right: isHorizontal ? width * 0.4 : 50,
          transform: `translateY(${(1 - labelSpring) * 30}px)`,
          opacity: labelSpring,
          fontSize: isHorizontal ? 48 : 58,
          fontWeight: 900,
          color: theme.text,
          letterSpacing: "-0.02em",
          fontFamily: theme.fontDisplay,
          lineHeight: 1.1,
          textShadow: `0 4px 24px rgba(0,0,0,0.8)`,
        }}
      >
        {highlight.label.split(" · ")[0]}
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: moodDef.color,
            marginTop: 8,
            letterSpacing: "0.04em",
          }}
        >
          {highlight.label.split(" · ").slice(1).join(" · ")}
        </div>
      </div>

      {/*
        Round 4c Fase 1.24 — KILLFEED ACUMULANDO (Mathieu spec: "killfeed
        sincronizado com kills do vídeo, com kills ACUMULANDO na tela a
        cada round, quando elas acontecem, no canto direito, no topo").
        Diferença vs Fase 1.20 (badges fade-out 3.5s): cada kill aparece
        quando killTime <= currentTime + PERMANECE até fim da cena.
        Reset entre highlights (componente é re-mounted per scene).
        Estilo aproxima killfeed CS2 vanilla — row vertical top-right
        com WEAPON tipograficamente colorido por categoria (rifle/sniper/
        smg/pistol/knife). Sprites SVG das armas: TODO Fase 1.24b
        (precisa source — repo killfeed-icons só referencia SVGs do CS2
        game, sem distribuição direta. Considerar SVGs free use ou
        criar próprios pixel-art).
      */}
      <div
        style={{
          position: "absolute",
          // Round 4d 3.4 (Mathieu 29/04): "Killcount invade o scoreboard
          // (overflow visual)". Killfeed pra baixo do scoreboard — top 220.
          // 06/05 (Mathieu spec): "ticker do bomb está sobrepondo o primeiro
          // kill do killfeed". Bomb timer ficou abaixo do scoreboard (top
          // 180, height 14 + label ~22 = bottom ~216). Killfeed em 220
          // ficava 4px abaixo — visualmente claustrofóbico + sombras
          // sobrepunham. Fix: empurrar killfeed top 220 → 280 (60px breathing
          // room abaixo do bomb timer). Horizontal mantém 32 (sem bomb timer
          // colidir lá — layout side-by-side).
          top: isHorizontal ? 32 : 280,
          right: isHorizontal ? 32 : 40,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: "flex-end",
          maxWidth: isHorizontal ? 520 : 620,
        }}
      >
        {highlight.kills.map((k, i) => {
          const killTimeSec = killTimeInSceneSec(
            k,
            i,
            highlight.kills.length,
            highlight.start,
            sceneDurationSec,
            sceneSkipSec,
            highlight.gameplayStartSec,
            // Round 4d 3.3 — rate compensation
            gameplayRate
          );
          const killFrame = s2f(killTimeSec);

          // Fase 1.24 — sem fade-out window. Kill aparece e PERMANECE até
          // fim da cena. Spring de entrada (translate + opacity in) só.
          const enterProgress = spring({
            frame: frame - killFrame,
            fps,
            config: { damping: 14, mass: 0.5 },
          });

          // Pula render antes do killTime
          if (enterProgress <= 0.001) return null;

          // Cor por categoria de arma — aproxima fragmovie/HLTV vibe.
          // Heurística simples por keywords no weapon name.
          const w = k.weapon.toLowerCase();
          let weaponColor: string = theme.text; // default branco
          if (/awp|scar|g3sg|ssg/.test(w)) weaponColor = "#ff6b35"; // sniper
          else if (/ak|m4|aug|famas|galil/.test(w)) weaponColor = "#fbbf24"; // rifle
          else if (/mp|mac|p90|bizon|ump/.test(w)) weaponColor = "#60a5fa"; // smg
          else if (/glock|usp|deagle|p2|five|tec|cz|elite|hkp/.test(w)) weaponColor = "#a78bfa"; // pistol
          else if (/knife|bayonet|karambit/.test(w)) weaponColor = "#4CAF82"; // knife
          else if (/grenade|nade|flash|smoke|molotov|incendiary/.test(w)) weaponColor = "#ff4444"; // grenades

          return (
            <div
              key={i}
              style={{
                transform: `translateX(${(1 - enterProgress) * 60}px)`,
                opacity: enterProgress,
                display: "flex",
                alignItems: "center",
                gap: 14,
                // Round 4c Fase 1.29 (Mathieu spec: "killfeed pode estar
                // maior só"). Padding + font sizes bumped ~50%.
                padding: isHorizontal ? "9px 18px" : "11px 22px",
                background: "rgba(0,0,0,0.82)",
                backdropFilter: "blur(10px)",
                borderRadius: 6,
                fontSize: isHorizontal ? 26 : 30,
                fontWeight: 700,
                color: theme.text,
                fontFamily: theme.fontDisplay,
                borderRight: `4px solid ${weaponColor}`,
                boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
              }}
            >
              {/* WEAPON tipograficamente — placeholder até Fase 1.24b SVG
                  sprites. Cor por categoria garante leitura rápida. */}
              <span style={{ color: weaponColor, fontWeight: 900, fontSize: isHorizontal ? 28 : 32 }}>
                {k.weapon.toUpperCase()}
              </span>
              <span
                style={{
                  color: theme.textDim,
                  fontSize: isHorizontal ? 18 : 22,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  fontFamily: theme.fontMono,
                }}
              >
                #{i + 1}
              </span>
              {k.headshot && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: isHorizontal ? "3px 9px" : "4px 10px",
                    borderRadius: 4,
                    background: moodDef.color,
                    color: "white",
                    fontSize: isHorizontal ? 17 : 20,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                  }}
                >
                  HS
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Score interno (highlight.score) é ferramenta interna do FragReel
          pra rankear quais kills viram highlight — NÃO aparece no vídeo. */}
    </AbsoluteFill>
  );
};
