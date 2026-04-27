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
  effectiveTailSkipSec,
  effectiveSceneEndSec,
  refStartSec,
  refSourceDurSec,
  resolveAliveAt,
} from "../../../theme";
import { Highlight } from "../../../types";

type Props = {
  highlight: Highlight;
  mood: keyof typeof MOODS;
  index: number; // 0, 1, 2... para variação de estilo
  // Round 4c Fase 1.27 — toggle scoreboard (default true). User opt-out
  // via UI no match-page. Quando false, badge só mostra `#N` rank.
  showScoreboard?: boolean;
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
export const HighlightScene: React.FC<Props> = ({ highlight, mood, index, showScoreboard = true }) => {
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
  const sceneSkipSec = effectiveSkipSec(sourceDurSec);
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
      highlight.gameplayStartSec
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

  // Flash branco no frame 0 (impacto)
  const flash = interpolate(frame, [0, 4, 8], [1, 0.3, 0], {
    extrapolateRight: "clamp",
  });

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

  // Round 4c Fase 1.29 (Mathieu revisão pós-Fase 1.27 PASS): "fades
  // entre rounds podem ser um pouco mais visíveis, pra entender que tem
  // uma mudança de round/fragreel". fadeOut 3 → 12 frames (0.4s) marca
  // CLARAMENTE a mudança visual entre highlights. Combinado com #N badge
  // restaurado (separador visual também), viewer entende cleanly "aqui
  // mudou de round".
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Parallax zoom no fundo (efeito dolly in)
  const zoom = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.08]
  );

  return (
    <AbsoluteFill style={{ opacity: fadeOut, background: theme.bg }}>
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

      {/* Flash de impacto */}
      <AbsoluteFill
        style={{
          background: "white",
          opacity: flash,
          pointerEvents: "none",
        }}
      />

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
          reels postados em redes sociais. */}
      <div
        style={{
          position: "absolute",
          bottom: isHorizontal ? 32 : 56,
          right: isHorizontal ? 32 : 40,
          opacity: 0.85,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: isHorizontal ? "5px 11px" : "6px 13px",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(6px)",
          borderRadius: 5,
          border: `1px solid ${moodDef.color}30`,
        }}
      >
        <span
          style={{
            fontSize: isHorizontal ? 10 : 12,
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
            fontSize: isHorizontal ? 12 : 14,
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
          top: isHorizontal ? 32 : 60,
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
            highlight.gameplayStartSec
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
