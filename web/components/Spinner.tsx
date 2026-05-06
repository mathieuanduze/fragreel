/**
 * Spinner — loaders animados (06/05).
 *
 * Mathieu spec: "Todos os loaders entre páginas precisam ser animados. Por
 * exemplo, quando as demos tão sendo mapeadas, só tem uma ampulheta parada,
 * quando está buscando os jogadores, só tem uma mensagem fixa." Substituiu
 * emoji ⏳ estático por SVG ring com rotação contínua + opcional barra de
 * progresso indeterminate.
 *
 * Variantes:
 *   <Spinner size={28} />                          → ring spinner só
 *   <Spinner label="Mapeando plays..." />          → ring + label
 *   <Spinner label="..." showBar />                → ring + label + bar
 *
 * Cor default = laranja Mathieu (#FF6B35). Customizável via `color` prop.
 */
type Props = {
  size?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  showBar?: boolean;
  /** centraliza num bloco com padding generoso pra empty/loading states */
  block?: boolean;
};

export default function Spinner({
  size = 28,
  color = "#FF6B35",
  label,
  sublabel,
  showBar = false,
  block = false,
}: Props) {
  const ring = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      style={{
        animation: "spin 0.9s linear infinite",
        flexShrink: 0,
      }}
      aria-label="Carregando"
      role="status"
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={color}
        strokeOpacity="0.18"
        strokeWidth="4"
      />
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="32 200"
      />
    </svg>
  );

  // Indeterminate progress bar (slides back and forth).
  const bar = (
    <div
      style={{
        marginTop: 14,
        width: "100%",
        maxWidth: 280,
        height: 4,
        borderRadius: 2,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: "40%",
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: "shimmer 1.6s ease-in-out infinite",
        }}
      />
    </div>
  );

  if (block) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "rgba(255,255,255,0.65)",
          border: "1px dashed #2D2D44",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          minHeight: 120,
          justifyContent: "center",
        }}
      >
        {ring}
        {label && (
          <div style={{ fontSize: 14, fontWeight: 600, color: "#E8E8F0", marginTop: 4 }}>
            {label}
          </div>
        )}
        {sublabel && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", maxWidth: 360 }}>
            {sublabel}
          </div>
        )}
        {showBar && bar}
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {ring}
      {label && <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{label}</span>}
    </div>
  );
}
