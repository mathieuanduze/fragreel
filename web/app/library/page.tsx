import DemosAnalisadasClient from "@/components/DemosAnalisadasClient";

export const metadata = { title: "Demos Analisadas · FragReel" };

/**
 * /library — "Demos Analisadas" (Sprint DEMO-3 v4, 08/05/2026).
 *
 * Mathieu spec: "as que já foram parseadas, à esquerda... à direita
 * players envolvidos com suas fotos e jogadas de impacto de cada um.
 * Selecionar player → CTA Editar FragReel → tela edição".
 *
 * Layout 2-painel:
 *   ┌─────────────────┬────────────────────────────────┐
 *   │ Demos analisadas│ Players da partida selecionada │
 *   │ (lista)         │  (CT roster | T roster)        │
 *   │                 │                                │
 *   │  ◉ Inferno      │  Click player → kills embaixo  │
 *   │    Mirage       │                                │
 *   │    Overpass     │  ┌─────────────────────────┐   │
 *   │                 │  │ Editar FragReel →       │   │
 *   └─────────────────┴────────────────────────────────┘
 */
export default function DemosAnalisadasPage() {
  return <DemosAnalisadasClient />;
}
