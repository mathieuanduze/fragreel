/**
 * affiliateProducts.ts — Catálogo de produtos afiliados.
 *
 * Plano monetização v2 (07/05/2026): stack affiliate-first low-touch.
 * Detalhes em [[03 - Monetização]] no Obsidian.
 *
 * Como adicionar produto:
 *   1. Mathieu cadastra programa (Amazon BR, Awin, etc) — recebe tag de afiliado
 *   2. Adiciona entry abaixo com tag real no link (substitui placeholder
 *      `?tag=fragreel-20` ou `awin1.com/awclick.php?mid=XXX&id=YYY`)
 *   3. Adiciona imagem em /public/affiliates/<slug>.jpg
 *   4. Pronto — `<AffiliateBanner>` lê e renderiza
 *
 * Slot semantics: cada produto declara `slot` que controla onde aparece.
 * Componente filtra por slot ao renderizar.
 *
 * Status placeholder: enquanto Mathieu não tem tags reais, links apontam
 * pra páginas de produto SEM afiliação (cliques NÃO geram comissão).
 * Substituir antes de promover em produção.
 */

export type AffiliateSlot =
  | "match-page"     // banner entre highlights na seleção
  | "render-screen"  // rotativo durante render (1-3min wait)
  | "post-render"    // peak emotional moment
  | "library-footer" // baixo prioridade na library
  | "coaching";      // categoria especial — coaching affiliate

export type AffiliateCategory =
  | "mouse"
  | "headset"
  | "keyboard"
  | "monitor"
  | "mousepad"
  | "chair"
  | "skin-marketplace"
  | "coaching";

export interface AffiliateProduct {
  id: string;                  // unique slug pra tracking
  slot: AffiliateSlot[];       // onde aparece
  category: AffiliateCategory;
  imageUrl: string;            // /affiliates/<slug>.jpg
  headline: string;            // título principal (max ~50 chars)
  product: string;             // nome do produto
  price?: string;              // "R$ 749" — opcional (preço varia)
  badge?: string;              // "Frete grátis prime" — opcional
  cta: string;                 // "Ver na Amazon" / "Ver oferta"
  link: string;                // affiliate URL com tag
  /** Programa de afiliado (pra analytics/tracking) */
  program: "amazon-br" | "awin" | "magalu" | "kabum" | "skinport" | "proguides" | "metafy" | "placeholder";
  /** Texto opcional pra context-aware placement (ex: "usado por pros") */
  context?: string;
  /** Top weakness mapping pra coaching (só aplicável a category=coaching) */
  weaknessTrigger?: "low-hs-rate" | "close-range-trades" | "clutch-fail" | "all";
}

/**
 * Catálogo inicial — Mathieu vai expandir conforme cadastra programas.
 *
 * IMPORTANTE: links abaixo são PLACEHOLDERS sem tag de afiliado real.
 * Antes de promover em produção, substituir por links com tags reais
 * dos programas cadastrados.
 */
export const AFFILIATE_PRODUCTS: AffiliateProduct[] = [
  // ── COACHING (high CTR contextual) ────────────────────────────────────
  {
    id: "proguides-cs2-coaching",
    slot: ["coaching", "post-render"],
    category: "coaching",
    imageUrl: "/affiliates/proguides-coaching.jpg",
    headline: "Coach pro de CS2",
    product: "ProGuides — coaching 1:1",
    price: "a partir de $49",
    cta: "Encontrar coach",
    link: "https://www.proguides.com/cs2?ref=fragreel-PLACEHOLDER",
    program: "placeholder",
    context: "Aprenda com pros: aim, posicionamento, decision-making",
    weaknessTrigger: "all",
  },

  // ── HARDWARE — MOUSE (top usage entre pros) ──────────────────────────
  {
    id: "logitech-gpro-superlight",
    slot: ["match-page", "render-screen"],
    category: "mouse",
    imageUrl: "/affiliates/logitech-gpro-superlight.jpg",
    headline: "Mouse #1 entre pros HLTV",
    product: "Logitech G Pro X Superlight",
    price: "R$ 749",
    badge: "Frete grátis Prime",
    cta: "Ver na Amazon",
    link: "https://www.amazon.com.br/dp/B09QWGQS3Q?tag=fragreel-PLACEHOLDER",
    program: "placeholder",
    context: "Usado por: ZywOo, NAF, dev1ce, Twistzz",
  },
  {
    id: "razer-deathadder-v3-pro",
    slot: ["match-page", "render-screen"],
    category: "mouse",
    imageUrl: "/affiliates/razer-deathadder-v3-pro.jpg",
    headline: "Razer DeathAdder V3 Pro",
    product: "Razer DeathAdder V3 Pro Wireless",
    price: "R$ 999",
    cta: "Ver oferta",
    link: "https://www.amazon.com.br/dp/B0BBPL4RCN?tag=fragreel-PLACEHOLDER",
    program: "placeholder",
    context: "Sensor Focus Pro 30K — preferência de aimers",
  },

  // ── HARDWARE — HEADSET ────────────────────────────────────────────────
  {
    id: "hyperx-cloud-iii",
    slot: ["match-page", "render-screen"],
    category: "headset",
    imageUrl: "/affiliates/hyperx-cloud-iii.jpg",
    headline: "Headset oficial CS2",
    product: "HyperX Cloud III",
    price: "R$ 599",
    cta: "Ver na Amazon",
    link: "https://www.amazon.com.br/dp/B0CFK2ZKXS?tag=fragreel-PLACEHOLDER",
    program: "placeholder",
    context: "Drivers 53mm — escuta passos antes do inimigo",
  },

  // ── HARDWARE — MOUSEPAD ───────────────────────────────────────────────
  {
    id: "hyperx-pulsefire-mat-xl",
    slot: ["render-screen"],
    category: "mousepad",
    imageUrl: "/affiliates/hyperx-pulsefire-mat-xl.jpg",
    headline: "Mousepad XL pra AWP",
    product: "HyperX Pulsefire Mat XL",
    price: "R$ 199",
    cta: "Ver oferta",
    link: "https://www.amazon.com.br/dp/B08F7ZXRRM?tag=fragreel-PLACEHOLDER",
    program: "placeholder",
    context: "Espaço de sobra pra low DPI (400-800)",
  },

  // ── SKIN MARKETPLACE (CPL) ────────────────────────────────────────────
  {
    id: "skinport-marketplace",
    slot: ["library-footer", "post-render"],
    category: "skin-marketplace",
    imageUrl: "/affiliates/skinport.jpg",
    headline: "Trade suas skins CS2",
    product: "Skinport — marketplace P2P",
    badge: "0% taxa primeiro trade",
    cta: "Ver skins",
    link: "https://skinport.com/?r=fragreel-PLACEHOLDER",
    program: "placeholder",
    context: "Marketplace legal — paga em USD direto na conta",
  },
];

/**
 * Helper: filtra produtos por slot. Component usa pra escolher
 * produtos apropriados pra contexto.
 */
export function getProductsForSlot(slot: AffiliateSlot): AffiliateProduct[] {
  return AFFILIATE_PRODUCTS.filter((p) => p.slot.includes(slot));
}

/**
 * Helper: pick aleatório com seed estável (mesmo highlight = mesmo produto)
 * pra evitar flicker de produto entre re-renders. Seed pode ser highlight.rank
 * ou match.id.
 */
export function pickProductForSlot(
  slot: AffiliateSlot,
  seed?: number,
): AffiliateProduct | null {
  const candidates = getProductsForSlot(slot);
  if (candidates.length === 0) return null;
  if (seed === undefined) return candidates[0];
  const idx = Math.abs(seed) % candidates.length;
  return candidates[idx];
}
