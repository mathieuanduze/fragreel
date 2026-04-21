import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { theme, MOODS } from "../../../theme";
import { Highlight } from "../../../types";

type Props = {
  highlight: Highlight;
  mood: keyof typeof MOODS;
  index: number; // 0, 1, 2... para variação de estilo
};

/**
 * HighlightScene — 4s por highlight
 * Placeholder de gameplay (já que não temos footage real ainda) + overlays cinematográficos.
 * Quando tivermos clip_url, substituiremos o placeholder por <OffthreadVideo>.
 */
export const HighlightScene: React.FC<Props> = ({ highlight, mood, index }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const moodDef = MOODS[mood];

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

  // Kills aparecem em cascata (kill feed)
  const killFeedStart = 15;

  // Score pts aparece no fim
  const scoreStart = durationInFrames - 30;
  const scoreProgress = interpolate(
    frame,
    [scoreStart, scoreStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Fade out últimos 6 frames
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 6, durationInFrames],
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
      {/* Fundo "gameplay" — placeholder até termos clip_url */}
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
        {/* Scanlines */}
        <AbsoluteFill
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 4px)",
          }}
        />
        {/* CS2-like HUD cross no centro */}
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

      {/* Rank badge — top left */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 50,
          transform: `scale(${rankSpring})`,
          opacity: rankSpring,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
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
            fontSize: 42,
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
            fontSize: 26,
            fontWeight: 700,
            color: theme.textMuted,
            letterSpacing: "0.15em",
            fontFamily: theme.fontDisplay,
          }}
        >
          R{highlight.round_num}
        </div>
      </div>

      {/* Label — bottom center */}
      <div
        style={{
          position: "absolute",
          bottom: 240,
          left: 50,
          right: 50,
          transform: `translateY(${(1 - labelSpring) * 30}px)`,
          opacity: labelSpring,
          fontSize: 58,
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

      {/* Kill feed — bottom, cascata */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 50,
          right: 50,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {highlight.kills.map((k, i) => {
          const killFrame = killFeedStart + i * 6;
          const killProgress = spring({
            frame: frame - killFrame,
            fps,
            config: { damping: 14, mass: 0.5 },
          });
          return (
            <div
              key={i}
              style={{
                transform: `translateX(${(1 - killProgress) * -60}px)`,
                opacity: killProgress,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 18px",
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${moodDef.color}30`,
                borderRadius: 8,
                fontSize: 22,
                fontWeight: 700,
                color: theme.text,
                fontFamily: theme.fontDisplay,
                alignSelf: "flex-start",
              }}
            >
              <span style={{ color: theme.textDim, fontSize: 18 }}>
                {k.weapon.toUpperCase()}
              </span>
              <span style={{ color: moodDef.color }}>▸</span>
              <span>{k.label}</span>
              {k.headshot && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: moodDef.color,
                    color: "white",
                    fontSize: 16,
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

      {/* Score pts — top right */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 50,
          opacity: scoreProgress,
          transform: `scale(${0.6 + scoreProgress * 0.4})`,
          padding: "14px 22px",
          background: `${moodDef.color}15`,
          border: `2px solid ${moodDef.color}`,
          borderRadius: 12,
          fontSize: 36,
          fontWeight: 900,
          color: moodDef.color,
          fontFamily: theme.fontDisplay,
          letterSpacing: "0.04em",
        }}
      >
        {Math.round(highlight.score)} PTS
      </div>
    </AbsoluteFill>
  );
};
