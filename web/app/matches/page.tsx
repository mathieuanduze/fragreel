import MinhasDemosClient from "@/components/MinhasDemosClient";

export const metadata = { title: "Minhas Demos · FragReel" };

/**
 * /matches — "Minhas Demos" UNIFIED (Sprint DEMO-3 v5, 08/05/2026).
 *
 * Mathieu spec: "Unificar Minhas Demos + Demos Analisadas em 1 tela com
 * expand inline". Lista única de demos do PC, expand inline pra escolher
 * player, click → /match/[id] direto.
 */
export default function MinhasDemosPage() {
  return <MinhasDemosClient />;
}
