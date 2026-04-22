import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, MOODS, SPRING } from "../theme";

/**
 * LowerThird — banner que entra no terço inferior do vídeo.
 *
 * Padrão broadcast (ESL/HLTV/CBLOL): logo + texto principal + texto secundário,
 * deslizando da esquerda. Aparece em ~0.4s e fica visível até ser removido
 * (componente externo controla quando aparece via Sequence).
 *
 * Ideal pra:
 *   - Identificar player no início (Outro/Intro)
 *   - Mostrar "1v3 CLUTCH" ou "ACE" durante uma cena de highlight
 *   - Estatística pontual ("ADR 86.4 · HS 45%")
 */
type Props = {
  // Texto principal (grande, white). Ex: "MATHIEU"
  title: string;
  // Texto secundário (pequeno, mood color). Ex: "ACE · ROUND 14"
  subtitle?: string;
  // Mood pra cor do destaque
  mood: keyof typeof MOODS;
  // Variant: "left" (broadcast clássico) ou "center" (impacto)
  variant?: "left" | "center";
  // Inicia animação X frames depois do começo da Sequence (default 0)
  delay?: number;
};

export const LowerThird: React.FC<Props> = ({
  title,
  subtitle,
  mood,
  variant = "left",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const moodDef = MOODS[mood];
  const isHorizontal = width > height;

  const enter = spring({
    frame: frame - delay,
    fps,
    config: SPRING.pop,
  });

  // Bottom proporcional — em vertical fica mais alto pra não competir com kill feed
  // (kill feed tá em top-right, então bottom é livre); em horizontal fica
  // padrão broadcast (~12% do bottom).
  const bottom = isHorizontal ? Math.round(height * 0.14) : Math.round(height * 0.18);

  const align = variant === "center" ? "center" : "flex-start";
  const translateX = variant === "left" ? (1 - enter) * -80 : 0;
  const translateY = variant === "center" ? (1 - enter) * 30 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: variant === "center" ? 0 : isHorizontal ? 40 : 50,
        right: variant === "center" ? 0 : "auto",
        bottom,
        transform: `translateX(${translateX}px) translateY(${translateY}px)`,
        opacity: enter,
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        gap: 6,
        pointerEvents: "none",
      }}
    >
      {/* Side bar acento (só no variant left) */}
      {variant === "left" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 6,
              height: isHorizontal ? 48 : 64,
              background: moodDef.color,
              borderRadius: 3,
              boxShadow: `0 0 16px ${moodDef.color}80`,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                fontSize: isHorizontal ? 36 : 48,
                fontWeight: 900,
                color: theme.text,
                fontFamily: theme.fontDisplay,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                textShadow: "0 2px 12px rgba(0,0,0,0.7)",
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  fontSize: isHorizontal ? 16 : 20,
                  fontWeight: 700,
                  color: moodDef.color,
                  fontFamily: theme.fontDisplay,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Center variant: tudo centralizado, fundo gradiente */}
      {variant === "center" && (
        <div
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)",
            padding: "14px 28px",
            borderRadius: 10,
            backdropFilter: "blur(6px)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: isHorizontal ? 40 : 56,
              fontWeight: 900,
              color: theme.text,
              fontFamily: theme.fontDisplay,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              textShadow: `0 0 28px ${moodDef.color}80`,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                marginTop: 6,
                fontSize: isHorizontal ? 18 : 22,
                fontWeight: 700,
                color: moodDef.color,
                fontFamily: theme.fontDisplay,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
