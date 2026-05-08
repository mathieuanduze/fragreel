"use client";

/**
 * AffiliateBanner — banner afiliado com paleta unificada laranja CT.
 *
 * Plano monetização v2 (07/05/2026): stack affiliate-first low-touch.
 * Detalhes em [[03 - Monetização]] no Obsidian.
 *
 * Paleta sóbria — segue redesign round 9 (laranja CT como ÚNICO accent,
 * resto greyscale). Não compete visualmente com o produto FragReel.
 *
 * Click tracking: cada banner emite event `affiliate-click` no
 * `window.fragreel.events` (se setado via outro lib). Fora isso, click
 * abre link em nova aba via target="_blank" rel="sponsored noopener".
 *
 * `rel="sponsored"` é IMPORTANTE pra Google entender que é affiliate
 * (não spam de outbound link). E `noopener` é segurança standard.
 */
import { useState } from "react";
import type { AffiliateProduct } from "@/lib/affiliateProducts";

type Props = {
  product: AffiliateProduct;
  /** Slot ID pra tracking (override do product.slot) */
  trackingSlot?: string;
  /** Layout: "compact" (1 linha, library footer) ou "card" (default) */
  variant?: "card" | "compact";
};

export default function AffiliateBanner({
  product,
  trackingSlot,
  variant = "card",
}: Props) {
  const [imgError, setImgError] = useState(false);

  const handleClick = () => {
    // Click tracking — fire and forget. Backend pode ler via window event
    // listener (analytics integration vem em sprint A4).
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("fragreel:affiliate-click", {
            detail: {
              productId: product.id,
              program: product.program,
              slot: trackingSlot || product.slot[0],
              timestamp: Date.now(),
            },
          }),
        );
      } catch {
        // ignore — tracking não é critical path
      }
    }
  };

  if (variant === "compact") {
    return (
      <a
        href={product.link}
        target="_blank"
        rel="sponsored noopener"
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          textDecoration: "none",
          color: "inherit",
          transition: "background 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,107,53,0.05)";
          e.currentTarget.style.borderColor = "rgba(255,107,53,0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.025)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        }}
      >
        {/* Sponsored marker — pequeno, top-left */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
            flexShrink: 0,
          }}
        >
          ADV
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.92)",
              marginBottom: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {product.headline}
          </div>
          {product.context && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {product.context}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#FF8E53",
            flexShrink: 0,
          }}
        >
          {product.cta} →
        </span>
      </a>
    );
  }

  // Card variant (default)
  return (
    <a
      href={product.link}
      target="_blank"
      rel="sponsored noopener"
      onClick={handleClick}
      style={{
        display: "block",
        position: "relative",
        textDecoration: "none",
        color: "inherit",
        background: "linear-gradient(180deg, rgba(20,20,30,0.9), rgba(13,13,26,0.95))",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        overflow: "hidden",
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,107,53,0.30)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Sponsored badge — top-right discreto */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 8,
          right: 10,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.30)",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
          background: "rgba(0,0,0,0.40)",
          padding: "2px 6px",
          borderRadius: 3,
          backdropFilter: "blur(4px)",
        }}
      >
        Patrocinado
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
        {/* Image — fallback gracioso pra category fallback */}
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 8,
            background: "rgba(0,0,0,0.30)",
            border: "1px solid rgba(255,255,255,0.05)",
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.product}
              onError={() => setImgError(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                padding: 6,
              }}
            />
          ) : (
            // Placeholder ASCII-friendly quando imagem não carrega
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "ui-monospace, monospace",
                textAlign: "center",
                padding: 4,
                lineHeight: 1.2,
              }}
            >
              {product.category}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              marginBottom: 4,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            {product.headline}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              marginBottom: product.context ? 4 : 8,
              fontWeight: 500,
            }}
          >
            {product.product}
          </div>
          {product.context && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.42)",
                marginBottom: 8,
                lineHeight: 1.45,
              }}
            >
              {product.context}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {product.price && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#FF8E53",
                  letterSpacing: "-0.01em",
                }}
              >
                {product.price}
              </span>
            )}
            {product.badge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.50)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "2px 7px",
                  borderRadius: 3,
                }}
              >
                {product.badge}
              </span>
            )}
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#FF8E53",
                marginLeft: "auto",
              }}
            >
              {product.cta} →
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
