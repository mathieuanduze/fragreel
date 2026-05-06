/**
 * HudV2.tsx — Sprint HUD V2 (06/05).
 *
 * Major-style minimalista HUD inspirado em cs2-react-hud + GHM (HLTV
 * broadcast). Substitui V1 (rank #N badge top-left + "3K Round X"
 * bottom-left + scoreboard CT/T antigo + watermark bottom-right).
 *
 * Mathieu spec (06/05):
 *   - Player name top-left, watermark abaixo
 *   - Score com 5-dots alive per team + round number central (R14/30)
 *   - Sem mapa, sem money, sem weapons (data não relevante / não temos)
 *   - Mobile-vertical first; desktop polish depois
 *   - Manter killfeed + bomb timer (separados deste component)
 *
 * Layout vertical 1080×1920:
 *   ┌─────────────────────────┐
 *   │  ●●●●○      ●●●●●       │  ← top-center: dots
 *   │  CT 4  14/30  5  T      │  ← scores + round
 *   │                         │
 *   │       GAMEPLAY          │
 *   │                         │
 *   │        ZYWOO            │  ← bottom-center stack
 *   │      fragreel.gg        │
 *   └─────────────────────────┘
 *
 * Anti-fadiga: minimalista por design — só info essencial. Player name
 * + score + round count = ~4 elementos visuais. Nada compete com gameplay.
 */
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { theme, MOODS, type Orientation } from "../../../theme";

const TEAM_CT_COLOR = "#60a5fa"; // azul
const TEAM_T_COLOR = "#fbbf24";  // amarelo

// MR15 (competitive default) = 30 rounds max. MR12 (premier) = 24.
// V1 default uses 30 — Mathieu pode iterar com game_mode detection se vier.
const DEFAULT_MAX_ROUNDS = 30;

type HudV2Props = {
  playerName: string;
  mood: keyof typeof MOODS;
  orientation: Orientation;
  /** Round atual (highlight.round_num). 1-indexed. */
  roundNum: number;
  /** Score CT (rounds won by CT side). */
  scoreCt: number;
  /** Score T. */
  scoreT: number;
  /** Alive count atual CT (0-5). Calc dinâmico via resolveAliveAt no parent. */
  aliveCt: number;
  /** Alive count atual T (0-5). */
  aliveT: number;
  /** True se temos timeline data pra alive counts. False → mostra dots all-on
   *  (default 5/5) como visual placeholder. */
  hasAliveTimeline: boolean;
  /** Total rounds máximo no game mode. Default 30 (MR15 competitive). */
  maxRounds?: number;
};

export const HudV2: React.FC<HudV2Props> = ({
  playerName,
  mood,
  orientation,
  roundNum,
  scoreCt,
  scoreT,
  aliveCt,
  aliveT,
  hasAliveTimeline,
  maxRounds = DEFAULT_MAX_ROUNDS,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const moodDef = MOODS[mood];
  const isHorizontal = orientation === "horizontal";

  // Spring entrance for the whole HUD (subtle slide-down + fade)
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  // ── Bottom-Center: Player name + watermark ────────────────────────────
  // Mathieu spec round 2 (06/05): "mantenha o player name no bottom center
  // e embaixo do player o watermark". Stack centralizado bottom (acima da
  // safe area do TikTok/Reels que tipicamente tem 150-200px de UI controls
  // bottom, então bottom: 240 vertical / 80 horizontal pra ficar visível
  // mas não overlap com app UI).
  // Animação: slide-up entry (vs slide-down do top-left antes).
  const bottomCenter = (
    <div style={{
      position: "absolute",
      bottom: isHorizontal ? 80 : 240,
      left: "50%",
      transform: `translateX(-50%) translateY(${(1 - entrance) * 20}px)`,
      opacity: entrance,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      pointerEvents: "none",
    }}>
      <div style={{
        fontSize: isHorizontal ? 40 : 52,
        fontWeight: 900,
        color: theme.text,
        letterSpacing: "-0.01em",
        fontFamily: theme.fontDisplay,
        textShadow: `0 2px 12px rgba(0,0,0,0.9), 0 0 32px ${moodDef.color}50`,
        lineHeight: 1,
      }}>
        {playerName.toUpperCase()}
      </div>
      <div style={{
        fontSize: isHorizontal ? 16 : 20,
        fontWeight: 700,
        color: moodDef.color,
        letterSpacing: "0.06em",
        fontFamily: theme.fontDisplay,
        textShadow: "0 2px 8px rgba(0,0,0,0.85)",
      }}>
        fragreel.gg
      </div>
    </div>
  );

  // ── Top-Center: Score with 5-dots + round number ──────────────────────
  // Layout proportional pra mobile vertical: dots | score | divider | score | dots
  // Effective alive: se sem timeline, mostra 5 (start state)
  const effectiveAliveCt = hasAliveTimeline ? aliveCt : 5;
  const effectiveAliveT = hasAliveTimeline ? aliveT : 5;

  const renderDots = (alive: number, color: string, mirror: boolean = false) => {
    const dots = Array.from({ length: 5 }, (_, i) => {
      // Para CT (esquerda): dots fill da DIREITA pra esquerda (player ativo perto
      // do centro). Para T (direita): dots fill da ESQUERDA pra direita.
      const dotIndex = mirror ? i : 4 - i; // mirror controla direção
      const isAlive = dotIndex < alive;
      return (
        <div
          key={i}
          style={{
            width: isHorizontal ? 10 : 12,
            height: isHorizontal ? 10 : 12,
            borderRadius: "50%",
            background: isAlive ? color : "rgba(255,255,255,0.15)",
            border: isAlive ? "none" : `1px solid rgba(255,255,255,0.2)`,
            boxShadow: isAlive ? `0 0 8px ${color}88` : "none",
            transition: "background 200ms ease, box-shadow 200ms ease",
          }}
        />
      );
    });
    return (
      <div style={{
        display: "flex",
        gap: isHorizontal ? 5 : 6,
        alignItems: "center",
      }}>
        {dots}
      </div>
    );
  };

  const topCenter = (
    <div style={{
      position: "absolute",
      top: isHorizontal ? 32 : 60,
      left: "50%",
      transform: `translateX(-50%) translateY(${(1 - entrance) * -16}px)`,
      opacity: entrance,
      display: "flex",
      alignItems: "center",
      gap: isHorizontal ? 14 : 18,
      padding: isHorizontal ? "10px 18px" : "14px 22px",
      background: "rgba(0,0,0,0.78)",
      backdropFilter: "blur(10px)",
      borderRadius: 12,
      border: `1px solid rgba(255,255,255,0.10)`,
      boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
    }}>
      {/* CT dots (left side, fill from right—players live closer to center) */}
      {renderDots(effectiveAliveCt, TEAM_CT_COLOR, false)}

      {/* CT label + score */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: isHorizontal ? 36 : 44,
      }}>
        <div style={{
          fontSize: isHorizontal ? 11 : 13,
          fontWeight: 800,
          color: TEAM_CT_COLOR,
          letterSpacing: "0.18em",
          fontFamily: theme.fontDisplay,
          lineHeight: 1,
        }}>
          CT
        </div>
        <div style={{
          fontSize: isHorizontal ? 28 : 34,
          fontWeight: 900,
          color: theme.text,
          fontFamily: theme.fontMono,
          lineHeight: 1,
        }}>
          {scoreCt}
        </div>
      </div>

      {/* Round number central */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: isHorizontal ? "0 10px" : "0 14px",
        borderLeft: "1px solid rgba(255,255,255,0.15)",
        borderRight: "1px solid rgba(255,255,255,0.15)",
      }}>
        <div style={{
          fontSize: isHorizontal ? 9 : 11,
          fontWeight: 700,
          color: theme.textMuted,
          letterSpacing: "0.18em",
          fontFamily: theme.fontDisplay,
          lineHeight: 1,
        }}>
          ROUND
        </div>
        <div style={{
          fontSize: isHorizontal ? 18 : 22,
          fontWeight: 800,
          color: theme.text,
          fontFamily: theme.fontMono,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}>
          {roundNum}
          <span style={{
            color: theme.textMuted,
            fontSize: isHorizontal ? 13 : 16,
            fontWeight: 600,
            marginLeft: 1,
          }}>
            /{maxRounds}
          </span>
        </div>
      </div>

      {/* T label + score */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: isHorizontal ? 36 : 44,
      }}>
        <div style={{
          fontSize: isHorizontal ? 11 : 13,
          fontWeight: 800,
          color: TEAM_T_COLOR,
          letterSpacing: "0.18em",
          fontFamily: theme.fontDisplay,
          lineHeight: 1,
        }}>
          T
        </div>
        <div style={{
          fontSize: isHorizontal ? 28 : 34,
          fontWeight: 900,
          color: theme.text,
          fontFamily: theme.fontMono,
          lineHeight: 1,
        }}>
          {scoreT}
        </div>
      </div>

      {/* T dots (right side, fill from left—players live closer to center) */}
      {renderDots(effectiveAliveT, TEAM_T_COLOR, true)}
    </div>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {topCenter}
      {bottomCenter}
    </AbsoluteFill>
  );
};
