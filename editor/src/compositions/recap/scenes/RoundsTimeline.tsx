import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme, MOODS } from "../../../theme";
import { Match } from "../../../types";

type Props = {
  match: Match;
  mood: keyof typeof MOODS;
};

/**
 * RoundsTimeline — 12s
 * Linha do tempo da partida: cada round vira uma "barrinha", os
 * highlights do jogador aparecem como flags coloridos. Placar
 * final aparece animado round-a-round.
 *
 * Como não temos winner-per-round no schema atual, mostramos só
 * a posição dos highlights ao longo dos rounds (visualmente é
 * suficiente pra dar a sensação de "história da partida").
 */
export const RoundsTimeline: React.FC<Props> = ({ match, mood }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const moodDef = MOODS[mood];

  // Placar final
  const [scoreA, scoreB] = (match.score || "0-0").split(/[\s\-–]+/);
  const finalA = parseInt(scoreA) || 0;
  const finalB = parseInt(scoreB) || 0;
  const totalRounds = finalA + finalB || 24; // fallback razoável

  // Header entra primeiro
  const headerSpring = spring({
    frame,
    fps,
    config: { damping: 14 },
  });

  // Animação da linha do tempo: cresce ao longo dos primeiros 6s
  const timelineProgress = interpolate(
    frame,
    [10, 6 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Placar final pulsa nos últimos 3s
  const scoreReveal = interpolate(
    frame,
    [durationInFrames - 90, durationInFrames - 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Score animado round-a-round (vai contando até o placar final)
  const animatedA = Math.round(finalA * timelineProgress);
  const animatedB = Math.round(finalB * timelineProgress);

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #0a0a15 0%, ${theme.bg} 100%)`,
        opacity: fadeOut,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.012) 0px,rgba(255,255,255,0.012) 1px,transparent 1px,transparent 3px)",
        }}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          gap: 40,
        }}
      >
        {/* Header */}
        <div
          style={{
            transform: `translateY(${(1 - headerSpring) * 30}px)`,
            opacity: headerSpring,
            fontSize: 32,
            fontWeight: 800,
            color: theme.text,
            letterSpacing: "0.28em",
            fontFamily: theme.fontDisplay,
          }}
        >
          A PARTIDA
        </div>

        {/* Placar contando */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            opacity: headerSpring,
          }}
        >
          <div
            style={{
              fontSize: 140,
              fontWeight: 900,
              color: theme.text,
              fontFamily: theme.fontMono,
              letterSpacing: "-0.05em",
              minWidth: 180,
              textAlign: "center",
              textShadow: `0 0 60px ${moodDef.color}40`,
            }}
          >
            {animatedA}
          </div>
          <div
            style={{
              fontSize: 100,
              fontWeight: 900,
              color: moodDef.color,
              fontFamily: theme.fontMono,
              opacity: 0.6,
            }}
          >
            ·
          </div>
          <div
            style={{
              fontSize: 140,
              fontWeight: 900,
              color: theme.textMuted,
              fontFamily: theme.fontMono,
              letterSpacing: "-0.05em",
              minWidth: 180,
              textAlign: "center",
            }}
          >
            {animatedB}
          </div>
        </div>

        {/* Timeline visual: barra horizontal de rounds */}
        <div
          style={{
            width: "100%",
            maxWidth: 880,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            marginTop: 20,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: theme.textDim,
              letterSpacing: "0.18em",
              fontFamily: theme.fontDisplay,
              textAlign: "center",
            }}
          >
            ROUND 1 → ROUND {totalRounds}
          </div>

          {/* Track de rounds */}
          <div
            style={{
              display: "flex",
              gap: 4,
              height: 56,
              alignItems: "stretch",
            }}
          >
            {Array.from({ length: totalRounds }).map((_, i) => {
              const myRound = i + 1;
              const roundReveal = interpolate(
                frame,
                [
                  10 + i * (4 * fps) / totalRounds,
                  10 + (i + 1) * (4 * fps) / totalRounds,
                ],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              const hasHighlight = match.highlights.some(
                (h) => h.round_num === myRound
              );
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: hasHighlight
                      ? moodDef.color
                      : "rgba(255,255,255,0.08)",
                    borderRadius: 4,
                    transform: `scaleY(${roundReveal})`,
                    transformOrigin: "bottom",
                    opacity: roundReveal,
                    boxShadow: hasHighlight
                      ? `0 0 14px ${moodDef.color}99`
                      : "none",
                  }}
                />
              );
            })}
          </div>

          {/* Legenda */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              opacity: timelineProgress,
              marginTop: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  background: moodDef.color,
                  borderRadius: 3,
                  boxShadow: `0 0 8px ${moodDef.color}`,
                }}
              />
              <span
                style={{
                  fontSize: 18,
                  color: theme.textMuted,
                  letterSpacing: "0.1em",
                  fontFamily: theme.fontDisplay,
                  fontWeight: 600,
                }}
              >
                {match.highlights.length} HIGHLIGHT
                {match.highlights.length === 1 ? "" : "S"}
              </span>
            </div>
          </div>
        </div>

        {/* Reveal final: "AGORA, OS MELHORES MOMENTOS" */}
        <div
          style={{
            opacity: scoreReveal,
            transform: `translateY(${(1 - scoreReveal) * 20}px)`,
            marginTop: 20,
            fontSize: 30,
            fontWeight: 700,
            color: moodDef.color,
            letterSpacing: "0.24em",
            fontFamily: theme.fontDisplay,
          }}
        >
          OS MELHORES MOMENTOS ↓
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
