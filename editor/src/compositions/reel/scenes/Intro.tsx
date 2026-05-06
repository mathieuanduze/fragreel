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
 * Intro — 5s (06/05 bumpado de 3s).
 *
 * Mathieu spec: "frame de início com nome do jogador e stats... precisa
 * ficar mais tempo, principalmente pra pessoa ler". Pré-Sprint: intro só
 * tinha name + map + score + "HIGHLIGHTS" tagline. Sem K/D, HS%, ADR,
 * RATING — Mathieu queria.
 *
 * Layout pós-fix:
 *   0-30   (1.0s)  → badge "COUNTER-STRIKE 2" + nome aparece (spring)
 *   6-36   (1.0s)  → mapa entra
 *   12-42  (1.0s)  → score (round wins) entra
 *   30-90  (2.0s)  → 4 stats em cascata (gap 8 frames entre cada — mesma
 *                     lógica do Outro pra leitura sequencial confortável)
 *   135-150 (0.5s) → fade out, transition pro highlight 1
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

  // Stats em cascata (06/05) — mesma cadência do Outro, começando depois
  // que name+map+score já settled.
  // 06/05 round 3 (Mathieu encurtou intro 5→3.5s pra retention TikTok):
  //   statsStart 30 → 18 (1.0→0.6s pós-início)
  //   statsGap   8  → 6  (0.27→0.20s entre cada)
  // Última stat lands em frame 18+18=36 (~1.2s). Sobra ~2s leitura + 0.3s
  // fade out (15 frames). Mais ágil mas ainda legível.
  const statsStart = 18;
  const statsGap = 6;

  // Fade out no último 0.5s
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" }
  );

  const stats = [
    { label: "K/D", value: match.stats.kd, color: theme.text },
    { label: "HS%", value: match.stats.hs, color: moodDef.color },
    { label: "ADR", value: match.stats.adr, color: theme.text },
    { label: "RATING", value: match.stats.rating, color: moodDef.color },
  ];

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

        {/* Stats grid (06/05) — K/D, HS%, ADR, RATING em cascata. Mesma
            lógica visual do Outro pra coerência. Cada stat fade+slide-in
            com gap de 8 frames pra leitura sequencial. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            width: "78%",
            marginTop: 12,
          }}
        >
          {stats.map((s, i) => {
            const statSpring = spring({
              frame: frame - (statsStart + i * statsGap),
              fps,
              config: { damping: 18, mass: 0.7 },
            });
            return (
              <div
                key={s.label}
                style={{
                  transform: `translateY(${(1 - statSpring) * 20}px)`,
                  opacity: statSpring,
                  padding: "12px 14px",
                  background: `${theme.bg}cc`,
                  border: `1px solid ${moodDef.color}30`,
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: theme.textDim,
                    letterSpacing: "0.15em",
                    fontFamily: theme.fontMono,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: s.color,
                    fontFamily: theme.fontDisplay,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
              </div>
            );
          })}
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
