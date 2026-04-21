import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CardProps } from "../../types";
import { theme, MOODS } from "../../theme";

/**
 * StoryCard — 9:16 imagem estática (1 frame usado no export)
 * Layout: map name background, player name grande, stats grid, top play, CTA.
 */
export const StoryCard: React.FC<CardProps> = ({
  match,
  playerName,
  mood,
}) => {
  const frame = useCurrentFrame();
  const moodDef = MOODS[mood];
  const mapName = match.map.replace("de_", "").toUpperCase();

  // Subtle pulse no export para quem pegar 1 frame após os 30 pulsos
  const pulse = interpolate(frame % 60, [0, 30, 60], [1, 1.02, 1]);

  const topPlay = match.highlights[0];

  const stats = [
    { label: "K/D", value: match.stats.kd },
    { label: "HS%", value: match.stats.hs },
    { label: "ADR", value: match.stats.adr },
    { label: "RATING", value: match.stats.rating, highlight: true },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse at 50% 30%, ${moodDef.color}25 0%, transparent 60%),
          linear-gradient(180deg, ${theme.bg} 0%, #1a1a2e 50%, ${theme.bg} 100%)
        `,
      }}
    >
      {/* Noise */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 3px)",
        }}
      />

      {/* Giant watermark map name */}
      <div
        style={{
          position: "absolute",
          top: "18%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 380,
          fontWeight: 900,
          color: "rgba(255,255,255,0.03)",
          letterSpacing: "-0.05em",
          fontFamily: theme.fontDisplay,
          lineHeight: 0.85,
          userSelect: "none",
          pointerEvents: "none",
          transform: `scale(${pulse})`,
        }}
      >
        {mapName}
      </div>

      {/* Corner marks */}
      {[
        { top: 50, left: 50 },
        { top: 50, right: 50 },
        { bottom: 50, left: 50 },
        { bottom: 50, right: 50 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: 48,
            height: 48,
            borderColor: moodDef.color,
            borderStyle: "solid",
            borderWidth: 0,
            opacity: 0.5,
            ...(pos.top ? { borderTopWidth: 3 } : { borderBottomWidth: 3 }),
            ...(pos.left ? { borderLeftWidth: 3 } : { borderRightWidth: 3 }),
          }}
        />
      ))}

      {/* Content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "120px 80px",
          gap: 40,
        }}
      >
        {/* Badge */}
        <div
          style={{
            alignSelf: "flex-start",
            padding: "8px 18px",
            background: `${moodDef.color}20`,
            border: `1px solid ${moodDef.color}60`,
            borderRadius: 999,
            fontSize: 20,
            fontWeight: 700,
            color: moodDef.color,
            letterSpacing: "0.1em",
            fontFamily: theme.fontDisplay,
          }}
        >
          · COUNTER-STRIKE 2 ·
        </div>

        {/* Player + map */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 108,
              fontWeight: 900,
              color: theme.text,
              letterSpacing: "-0.04em",
              fontFamily: theme.fontDisplay,
              lineHeight: 0.95,
              textShadow: `0 0 60px ${moodDef.color}50`,
            }}
          >
            {playerName}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: theme.textMuted,
              letterSpacing: "0.08em",
              fontFamily: theme.fontDisplay,
            }}
          >
            {mapName} · {match.score} · {match.date}
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Top play card */}
        {topPlay && (
          <div
            style={{
              padding: "24px 28px",
              background: "rgba(22,33,62,0.7)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${moodDef.color}40`,
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: moodDef.color,
                letterSpacing: "0.15em",
                fontFamily: theme.fontDisplay,
              }}
            >
              TOP PLAY
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: theme.text,
                letterSpacing: "-0.02em",
                fontFamily: theme.fontDisplay,
                lineHeight: 1.1,
              }}
            >
              {topPlay.label}
            </div>
            <div
              style={{
                fontSize: 22,
                color: theme.textDim,
                fontFamily: theme.fontDisplay,
                fontWeight: 600,
              }}
            >
              Round {topPlay.round_num} · {topPlay.kills.length} kills ·{" "}
              {Math.round(topPlay.score)} pts
            </div>
          </div>
        )}

        {/* Stats grid 2x2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                padding: "20px 24px",
                background: "#16213E",
                border: `1px solid ${s.highlight ? moodDef.color : theme.border}`,
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
                  fontSize: 52,
                  fontWeight: 900,
                  color: s.highlight ? moodDef.color : theme.text,
                  fontFamily: theme.fontMono,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* CTA footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: theme.textDim,
              fontWeight: 600,
              fontFamily: theme.fontDisplay,
              letterSpacing: "0.05em",
            }}
          >
            CRIE O SEU
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: moodDef.color,
              fontFamily: theme.fontDisplay,
              letterSpacing: "-0.01em",
            }}
          >
            fragreel.app
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
