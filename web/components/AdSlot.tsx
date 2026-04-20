"use client";

/**
 * AdSlot — placeholder visual para espaços publicitários.
 * Em produção, substituir o conteúdo interno pelo tag do ad network
 * (Google Ad Manager, etc.) mantendo o wrapper externo intacto.
 */

type AdSlotProps = {
  id: string;
  size: "leaderboard" | "rectangle" | "banner" | "native";
  label?: string;
};

const SIZE_MAP = {
  leaderboard: { width: "100%", maxWidth: 728, height: 90 },
  rectangle:   { width: "100%", maxWidth: 300, height: 250 },
  banner:      { width: "100%", maxWidth: "100%", height: 60 },
  native:      { width: "100%", maxWidth: "100%", height: 120 },
};

export default function AdSlot({ id, size, label }: AdSlotProps) {
  const dim = SIZE_MAP[size];

  return (
    <div
      id={id}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: dim.maxWidth,
          height: dim.height,
          background: "#13132A",
          border: "1px dashed #2D2D44",
          borderRadius: size === "native" ? 12 : 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ad label */}
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 8,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.2)",
            textTransform: "uppercase",
          }}
        >
          Publicidade
        </div>

        {/* Placeholder content */}
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.15)", fontWeight: 600 }}>
          {label ?? `Anúncio · ${size}`}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.08)" }}>
          {dim.maxWidth === "100%" ? "Responsive" : `${dim.maxWidth}×${dim.height}`}
        </div>
      </div>
    </div>
  );
}
