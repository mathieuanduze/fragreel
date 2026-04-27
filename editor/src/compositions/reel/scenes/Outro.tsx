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
 * Outro — 3.0s (Round 4c Fase 1.19, era 2.5s → 1.5s → 3.0s).
 * Mathieu: "título e stats no final, não ficam tempo o suficiente para ler".
 * Stats finais + CTA "fragreel.app".
 *
 * Timing dos 90 frames (3.0s @ 30fps):
 *   0-15    (0.5s)  → playerName + mapa+score entram (titleSpring)
 *   10-34   (0.8s)  → 4 stats em cascata (8 frames gap entre cada)
 *   55-90   (1.2s)  → CTA visível + reading time
 *   34-55   (0.7s)  → todos stats settled, antes do CTA disputar atenção
 */
export const Outro: React.FC<Props> = ({ match, playerName, mood }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const moodDef = MOODS[mood];

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14 },
  });

  // Stats entram em cascata (4 stats), gap 8 frames pra leitura sequencial
  // mais deliberada (era 5 frames, muito apressado pra ler).
  const statsStart = 10;
  const statsGap = 8;

  const ctaStart = 55;
  const ctaSpring = spring({
    frame: frame - ctaStart,
    fps,
    config: { damping: 16, mass: 1 },
  });

  const stats = [
    { label: "K/D", value: match.stats.kd, color: theme.text },
    { label: "HS%", value: match.stats.hs, color: moodDef.color },
    { label: "ADR", value: match.stats.adr, color: theme.text },
    { label: "RATING", value: match.stats.rating, color: moodDef.color },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${moodDef.color}15 0%, ${theme.bg} 80%)`,
      }}
    >
      {/* Grain */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.015) 0px,rgba(255,255,255,0.015) 1px,transparent 1px,transparent 3px)",
        }}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          gap: 28,
        }}
      >
        {/* Player */}
        <div
          style={{
            opacity: titleSpring,
            transform: `scale(${titleSpring})`,
            fontSize: 72,
            fontWeight: 900,
            color: theme.text,
            letterSpacing: "-0.03em",
            fontFamily: theme.fontDisplay,
          }}
        >
          {playerName}
        </div>

        {/* Mapa + score */}
        <div
          style={{
            opacity: titleSpring * 0.7,
            fontSize: 28,
            color: theme.textMuted,
            letterSpacing: "0.1em",
            fontFamily: theme.fontDisplay,
            fontWeight: 600,
          }}
        >
          {match.map.replace("de_", "").toUpperCase()} · {match.score}
        </div>

        {/* Stats grid 2x2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginTop: 20,
            width: "100%",
            maxWidth: 760,
          }}
        >
          {stats.map((s, i) => {
            const statProgress = spring({
              frame: frame - (statsStart + i * statsGap),
              fps,
              config: { damping: 14 },
            });
            return (
              <div
                key={s.label}
                style={{
                  transform: `translateY(${(1 - statProgress) * 30}px)`,
                  opacity: statProgress,
                  padding: "22px 24px",
                  background: "#16213E",
                  border: `1px solid ${moodDef.color}30`,
                  borderRadius: 14,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: theme.textDim,
                    letterSpacing: "0.15em",
                    fontFamily: theme.fontDisplay,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: s.color,
                    fontFamily: theme.fontMono,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 30,
            transform: `translateY(${(1 - ctaSpring) * 20}px)`,
            opacity: ctaSpring,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: theme.textMuted,
              letterSpacing: "0.2em",
              fontWeight: 600,
              fontFamily: theme.fontDisplay,
            }}
          >
            CRIE O SEU EM
          </div>
          <div
            style={{
              padding: "16px 32px",
              background: moodDef.color,
              borderRadius: 14,
              fontSize: 38,
              fontWeight: 900,
              color: "white",
              fontFamily: theme.fontDisplay,
              letterSpacing: "-0.01em",
              boxShadow: `0 0 60px ${moodDef.color}60`,
            }}
          >
            fragreel.app
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
