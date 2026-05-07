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
  /** Sprint #6.5 POV (06/05) — quando true, HUD desaparece (Mathieu spec:
   *  "A HUD precisa desaparecer, é um corte, no meio do jogo, pra ver de
   *  outro ângulo"). Volta visível quando false. */
  hidden?: boolean;
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
  hidden = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const moodDef = MOODS[mood];
  const isHorizontal = orientation === "horizontal";

  // Sprint #6.5 POV (06/05) — HUD desaparece durante POV cut. Mathieu spec:
  // "A HUD precisa desaparecer, é um corte, no meio do jogo, pra ver de
  // outro ângulo. fica claro que é um replay pro usuário". Volta visível
  // quando hidden=false (POV window terminou).
  if (hidden) {
    return null;
  }

  // Spring entrance for the whole HUD (subtle slide-down + fade)
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  // ── Bottom-Center: Player name + watermark ────────────────────────────
  // Mathieu spec round 3 (06/05): "O nome do player tá muito solto na tela,
  // precisaria de uma estilização em volta para ficar com cara de hud.
  // Watermark fragreel MUITO pequena. Pode voltar pra versão que era antes,
  // só coloca ela centralizada embaixo do nome".
  //
  // Mudanças:
  //   - Container HUD-style igual o top scoreboard (bg + blur + border +
  //     shadow). Player name não fica "solto", vira widget.
  //   - Watermark fontSize bumpado de volta pro tamanho antes (V1 bottom-
  //     right tinha 30px vertical) — agora 30px também aqui, centralizado.
  //   - Player name mantém 52px (estava bom Mathieu disse).
  const bottomCenter = (
    <div style={{
      position: "absolute",
      bottom: isHorizontal ? 80 : 240,
      left: "50%",
      transform: `translateX(-50%) translateY(${(1 - entrance) * 20}px)`,
      opacity: entrance,
      pointerEvents: "none",
      // Container HUD-style — igual top scoreboard
      padding: isHorizontal ? "10px 28px" : "14px 36px",
      background: "rgba(0,0,0,0.78)",
      backdropFilter: "blur(10px)",
      borderRadius: 12,
      border: `1px solid ${moodDef.color}40`,
      boxShadow: `0 6px 24px rgba(0,0,0,0.5), 0 0 28px ${moodDef.color}25`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
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
        fontSize: isHorizontal ? 24 : 30,
        fontWeight: 900,
        color: moodDef.color,
        letterSpacing: "-0.01em",
        fontFamily: theme.fontDisplay,
        textShadow: "0 2px 8px rgba(0,0,0,0.85)",
        lineHeight: 1,
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
      const dotIndex = mirror ? i : 4 - i;
      const isAlive = dotIndex < alive;
      return (
        <div
          key={i}
          style={{
            width: isHorizontal ? 14 : 14,   // bumpado pra mais visível
            height: isHorizontal ? 14 : 14,
            borderRadius: "50%",
            background: isAlive ? color : "rgba(255,255,255,0.15)",
            border: isAlive ? "none" : `1px solid rgba(255,255,255,0.2)`,
            boxShadow: isAlive ? `0 0 10px ${color}99` : "none",
            transition: "background 200ms ease, box-shadow 200ms ease",
          }}
        />
      );
    });
    return (
      <div style={{
        display: "flex",
        gap: isHorizontal ? 7 : 7,
        alignItems: "center",
      }}>
        {dots}
      </div>
    );
  };

  // Mathieu round 3 spec: "ele pode ser até maior em tamanho, principalmente
  // na horizontal". Bump fontSizes/padding/gaps especialmente horizontal
  // (era pequeno demais pra widescreen). Vertical bump menor pra não
  // dominar mobile feed.
  const topCenter = (
    <div style={{
      position: "absolute",
      top: isHorizontal ? 36 : 60,
      left: "50%",
      transform: `translateX(-50%) translateY(${(1 - entrance) * -16}px)`,
      opacity: entrance,
      display: "flex",
      alignItems: "center",
      gap: isHorizontal ? 22 : 22,
      padding: isHorizontal ? "16px 28px" : "16px 26px",
      background: "rgba(0,0,0,0.78)",
      backdropFilter: "blur(10px)",
      borderRadius: 14,
      border: `1px solid rgba(255,255,255,0.10)`,
      boxShadow: "0 6px 28px rgba(0,0,0,0.55)",
    }}>
      {/* CT dots (left side, fill from right—players live closer to center) */}
      {renderDots(effectiveAliveCt, TEAM_CT_COLOR, false)}

      {/* CT label + score */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minWidth: isHorizontal ? 56 : 56,
      }}>
        <div style={{
          fontSize: isHorizontal ? 16 : 16,
          fontWeight: 800,
          color: TEAM_CT_COLOR,
          letterSpacing: "0.2em",
          fontFamily: theme.fontDisplay,
          lineHeight: 1,
        }}>
          CT
        </div>
        <div style={{
          fontSize: isHorizontal ? 42 : 42,
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
        gap: 4,
        padding: isHorizontal ? "0 18px" : "0 16px",
        borderLeft: "1px solid rgba(255,255,255,0.15)",
        borderRight: "1px solid rgba(255,255,255,0.15)",
      }}>
        <div style={{
          fontSize: isHorizontal ? 13 : 13,
          fontWeight: 700,
          color: theme.textMuted,
          letterSpacing: "0.2em",
          fontFamily: theme.fontDisplay,
          lineHeight: 1,
        }}>
          ROUND
        </div>
        <div style={{
          fontSize: isHorizontal ? 26 : 26,
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
            fontSize: isHorizontal ? 18 : 18,
            fontWeight: 600,
            marginLeft: 2,
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
        gap: 4,
        minWidth: isHorizontal ? 56 : 56,
      }}>
        <div style={{
          fontSize: isHorizontal ? 16 : 16,
          fontWeight: 800,
          color: TEAM_T_COLOR,
          letterSpacing: "0.2em",
          fontFamily: theme.fontDisplay,
          lineHeight: 1,
        }}>
          T
        </div>
        <div style={{
          fontSize: isHorizontal ? 42 : 42,
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
