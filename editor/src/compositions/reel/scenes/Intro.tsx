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
  playerName: string;
  mood: keyof typeof MOODS;
};

/**
 * Intro — 2s
 * Fundo com gradiente, logo/player name, mapa e score.
 * Elementos entram com spring.
 */
export const Intro: React.FC<Props> = ({ match, playerName, mood }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const moodDef = MOODS[mood];

  // Player name entra com spring no frame 0
  const nameSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  // Mapa entra atrasado (6 frames)
  const mapSpring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  // Score entra mais atrasado (12 frames)
  const scoreSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 16, mass: 1 },
  });

  // Fade out no último 0.5s
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" }
  );

  const mapName = match.map
    .replace("de_", "")
    .toUpperCase();

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${moodDef.color}22 0%, ${theme.bg} 70%)`,
        opacity: fadeOut,
      }}
    >
      {/* Noise/grain overlay */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.015) 0px,rgba(255,255,255,0.015) 1px,transparent 1px,transparent 3px)",
          pointerEvents: "none",
        }}
      />

      {/* Center stack */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 24,
          padding: 80,
        }}
      >
        {/* Badge CS2 */}
        <div
          style={{
            transform: `translateY(${(1 - nameSpring) * 40}px)`,
            opacity: nameSpring,
            padding: "10px 22px",
            background: `${moodDef.color}15`,
            border: `1px solid ${moodDef.color}40`,
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 700,
            color: moodDef.color,
            letterSpacing: "0.08em",
            fontFamily: theme.fontDisplay,
          }}
        >
          · COUNTER-STRIKE 2 ·
        </div>

        {/* Player name */}
        <div
          style={{
            transform: `translateY(${(1 - nameSpring) * 30}px)`,
            opacity: nameSpring,
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            color: theme.text,
            textAlign: "center",
            fontFamily: theme.fontDisplay,
            lineHeight: 1,
            textShadow: `0 0 80px ${moodDef.color}60`,
          }}
        >
          {playerName}
        </div>

        {/* Mapa */}
        <div
          style={{
            transform: `scale(${mapSpring})`,
            opacity: mapSpring,
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: theme.textMuted,
            fontFamily: theme.fontDisplay,
          }}
        >
          {mapName}
        </div>

        {/* Score */}
        <div
          style={{
            transform: `translateY(${(1 - scoreSpring) * 20}px)`,
            opacity: scoreSpring,
            fontSize: 40,
            fontWeight: 700,
            color: moodDef.color,
            fontFamily: theme.fontMono,
            letterSpacing: "0.1em",
          }}
        >
          {match.score}
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 20,
            opacity: scoreSpring * 0.6,
            fontSize: 28,
            fontWeight: 600,
            color: theme.textDim,
            letterSpacing: "0.3em",
            fontFamily: theme.fontDisplay,
          }}
        >
          HIGHLIGHTS
        </div>
      </AbsoluteFill>

      {/* Corner frame marks */}
      {[
        { top: 40, left: 40 },
        { top: 40, right: 40 },
        { bottom: 40, left: 40 },
        { bottom: 40, right: 40 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: 36,
            height: 36,
            borderColor: moodDef.color,
            borderStyle: "solid",
            borderWidth: 0,
            ...(pos.top
              ? { borderTopWidth: 2 }
              : { borderBottomWidth: 2 }),
            ...(pos.left
              ? { borderLeftWidth: 2 }
              : { borderRightWidth: 2 }),
            opacity: nameSpring * 0.7,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
