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
} from "../../../theme";
import { Highlight } from "../../../types";

type Props = {
  highlight: Highlight;
  mood: keyof typeof MOODS;
  index: number; // 0, 1, 2... para variação de estilo
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
export const HighlightScene: React.FC<Props> = ({ highlight, mood, index }) => {
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
  const sourceDurSec = Math.max(0.1, highlight.end - highlight.start);
  // Round 4c Fase 1.22 (Mathieu reportou pós-Fase 1.21: "vídeo fica
  // pausado por 1 segundo antes da transição, parece que trava"). TAIL
  // fixo cortava do FIM do source — quando última kill era cedo no
  // cluster, sobrava dead time pós-action visível. Fix: kill-aware
  // sceneEndSec via theme helper (last_kill + REACTION_PAD), capped
  // pelo TAIL fallback. Available video = sceneEndSec - frontSkip,
  // mesma fórmula da scene duration em HighlightsReel — DEVEM bater
  // pra evitar freeze edge no fim.
  const sceneSkipSec = effectiveSkipSec(sourceDurSec);
  const sceneEndInSourceSec = effectiveSceneEndSec(highlight);
  const availableVideoSec = Math.max(0.1, sceneEndInSourceSec - sceneSkipSec);
  const gameplayRate = availableVideoSec / sceneDurationSec;

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

  // Round 4c Fase 1.21 (Mathieu re-cobrou pós-Fase 1.20): "transições
  // ainda estão demorando muito entre plays, não precisa de um pause
  // tão longo entre cada cena". fadeOut 6 → 3 frames (0.1s) — quase um
  // direct cut, perdendo "respiração" mas ganhando ritmo. Combinado com
  // TAIL_SKIP 4.5s (Fase 1.21 theme.ts) corta dead time + cut rápido =
  // sensação de "edição profissional" sem pause perceptível.
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 3, durationInFrames],
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

      {/* Rank badge — top left (mesmo lugar nos dois formatos).
          Round 4c Fase 1.21 (Mathieu re-cobrou pós-Fase 1.19): "Round 8
          repete embaixo, info que está lá não serve pra nada. Importante
          seria: quantos players vivos CT vs T, quanta vida o user tem".
          Redesign: remove "JOGADA + Round N" redundante, mostra info
          ÚTIL derivada do kills array (sem mudar API/parser): contagem
          de kills + headshots. Pra alive count CT vs T + HP do user
          precisaria enrich Highlight type via parser — TODO Fase 1.22+
          (h.context.alive_ct, h.context.alive_t, h.context.user_hp). */}
      <div
        style={{
          position: "absolute",
          top: isHorizontal ? 40 : 80,
          left: isHorizontal ? 40 : 50,
          transform: `scale(${rankSpring})`,
          opacity: rankSpring,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* Big número de kills — info imediata "quantas frags foi essa play".
              Round 4c Fase 1.22.1 (PC test cosmético): pluralização correta
              singular vs plural ("1 KILL" vs "2 KILLS"). */}
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
          {/* Detalhe: HS count colorido pro mood. Só mostra se houver. */}
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
        Kill feed — TOP-RIGHT, convenção CS2 (HUD vanilla). Cada kill aparece
        no momento real (kill.time relativo a highlight.start) ou estimativa
        uniforme se o parser ainda não fornece time. Mantém últimas 5 kills
        visíveis (FIFO) — em ace de 5+ kills, a primeira sai quando a sexta entra.
      */}
      <div
        style={{
          position: "absolute",
          top: isHorizontal ? 32 : 60,
          right: isHorizontal ? 32 : 40,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "flex-end",
          maxWidth: isHorizontal ? 520 : 620,
        }}
      >
        {highlight.kills.map((k, i) => {
          // Round 4c Fase 1.20 BUG FIX (Mathieu: "kills não aparecem em
          // cima à direita junto com o momento que elas acontecem").
          // Passar sceneSkipSec pra alinhar killfeed com o playback do
          // gameplay (que pula sceneSkipSec do início via OffthreadVideo
          // startFrom). Sem isso, killfeed aparecia ~4s atrasado dos
          // tiros reais.
          const killTimeSec = killTimeInSceneSec(
            k,
            i,
            highlight.kills.length,
            highlight.start,
            sceneDurationSec,
            sceneSkipSec
          );
          const killFrame = s2f(killTimeSec);

          // Janela de visibilidade: aparece no killFrame, fica por ~3.5s,
          // depois fade out. Cobre o caso de cena longa (10s recap) sem
          // poluir tela com 5 cards congelados.
          const showWindow = s2f(3.5);
          const fadeWindow = s2f(0.4);

          const enterProgress = spring({
            frame: frame - killFrame,
            fps,
            config: { damping: 14, mass: 0.5 },
          });
          const exitFade = interpolate(
            frame,
            [
              killFrame + showWindow,
              killFrame + showWindow + fadeWindow,
            ],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const opacity = enterProgress * exitFade;

          // Pula render quando totalmente invisível — economiza pintura.
          if (opacity <= 0.001) return null;

          return (
            <div
              key={i}
              style={{
                transform: `translateX(${(1 - enterProgress) * 60}px)`,
                opacity,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                background: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${moodDef.color}40`,
                borderRadius: 6,
                fontSize: isHorizontal ? 20 : 22,
                fontWeight: 700,
                color: theme.text,
                fontFamily: theme.fontDisplay,
              }}
            >
              {/* Round 4c Fase 1.20 — render simplificado. Antes mostrava
                  `weapon ▸ label`, mas API _kill_label() retorna só
                  "WEAPON · HS" (sem victim name) — Mathieu viu "AK47 ▸ AK-47"
                  redundante. Fix Mac-side: mostra weapon + KILL index (#N de
                  total) + HS badge. Mais informativo (sequência das kills)
                  sem precisar mudar API/parser. Pro futuro: API enrich Kill
                  com victim_name pra render killer ▸ victim canonical. */}
              <span style={{ color: theme.text, fontSize: isHorizontal ? 20 : 22, fontWeight: 800 }}>
                {k.weapon.toUpperCase()}
              </span>
              <span
                style={{
                  color: moodDef.color,
                  fontSize: isHorizontal ? 14 : 16,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  fontFamily: theme.fontMono,
                }}
              >
                #{i + 1}/{highlight.kills.length}
              </span>
              {k.headshot && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: moodDef.color,
                    color: "white",
                    fontSize: isHorizontal ? 14 : 16,
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
