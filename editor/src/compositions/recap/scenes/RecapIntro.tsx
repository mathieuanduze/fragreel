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
 * RecapIntro — 4s
 * Formato Recap = vídeo retrospectivo da partida inteira (~60s).
 * Intro mais "documentário" que o Reel: foca em "RECAP", número de
 * rounds e mostra o placar grande logo de cara.
 */
export const RecapIntro: React.FC<Props> = ({ match, playerName, mood }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const moodDef = MOODS[mood];

  const tagSpring = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const scoreSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 12, mass: 0.7 },
  });
  const subSpring = spring({
    frame: frame - 18,
    fps,
    config: { damping: 16, mass: 1 },
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" }
  );

  const mapName = match.map.replace("de_", "").toUpperCase();

  // Parse "13-9" → ["13", "9"]
  const [scoreA, scoreB] = (match.score || "0-0").split(/[\s\-–]+/);
  const totalRounds = (parseInt(scoreA) || 0) + (parseInt(scoreB) || 0);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${moodDef.color}1A 0%, ${theme.bg} 75%)`,
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
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 24,
          padding: 80,
        }}
      >
        {/* Tag RECAP */}
        <div
          style={{
            transform: `translateY(${(1 - tagSpring) * 30}px)`,
            opacity: tagSpring,
            padding: "10px 26px",
            background: `${moodDef.color}18`,
            border: `1px solid ${moodDef.color}50`,
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 700,
            color: moodDef.color,
            letterSpacing: "0.32em",
            fontFamily: theme.fontDisplay,
          }}
        >
          · RECAP COMPLETO ·
        </div>

        {/* Player */}
        <div
          style={{
            transform: `translateY(${(1 - tagSpring) * 24}px)`,
            opacity: tagSpring,
            fontSize: 64,
            fontWeight: 800,
            color: theme.textMuted,
            letterSpacing: "-0.02em",
            fontFamily: theme.fontDisplay,
            lineHeight: 1,
          }}
        >
          {playerName}
        </div>

        {/* SCORE GIGANTE — coração do recap */}
        <div
          style={{
            opacity: scoreSpring,
            transform: `scale(${0.7 + scoreSpring * 0.3})`,
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginTop: 20,
          }}
        >
          <div
            style={{
              fontSize: 220,
              fontWeight: 900,
              color: theme.text,
              fontFamily: theme.fontMono,
              letterSpacing: "-0.06em",
              lineHeight: 1,
              textShadow: `0 0 80px ${moodDef.color}50`,
            }}
          >
            {scoreA || "0"}
          </div>
          <div
            style={{
              fontSize: 120,
              fontWeight: 900,
              color: moodDef.color,
              fontFamily: theme.fontMono,
              opacity: 0.7,
            }}
          >
            ·
          </div>
          <div
            style={{
              fontSize: 220,
              fontWeight: 900,
              color: theme.textMuted,
              fontFamily: theme.fontMono,
              letterSpacing: "-0.06em",
              lineHeight: 1,
            }}
          >
            {scoreB || "0"}
          </div>
        </div>

        {/* Mapa + rounds */}
        <div
          style={{
            transform: `translateY(${(1 - subSpring) * 18}px)`,
            opacity: subSpring,
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginTop: 14,
            fontFamily: theme.fontDisplay,
          }}
        >
          <span
            style={{
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: theme.text,
            }}
          >
            {mapName}
          </span>
          <span style={{ fontSize: 30, color: theme.textDim }}>·</span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: theme.textMuted,
              letterSpacing: "0.08em",
            }}
          >
            {totalRounds} ROUNDS
          </span>
        </div>
      </AbsoluteFill>

      {/* Corner marks */}
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
            ...(pos.top ? { borderTopWidth: 2 } : { borderBottomWidth: 2 }),
            ...(pos.left ? { borderLeftWidth: 2 } : { borderRightWidth: 2 }),
            opacity: tagSpring * 0.6,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
