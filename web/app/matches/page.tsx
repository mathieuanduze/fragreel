import MatchesPageClient from "@/components/MatchesPageClient";

export const metadata = { title: "Minhas Demos · FragReel" };

/**
 * /matches — "Minhas Demos" (Sprint DEMO-3 v4, 08/05/2026).
 *
 * Mathieu spec: "Match history tem que virar Minhas demos, ali, vai
 * aparecer todas as demos que a pessoa tem baixadas no computador,
 * como fazíamos antes... CTA → Analisar Demos".
 *
 * Lista de .dem detectadas pelo client local (127.0.0.1:5775/demos).
 * Per-card CTA "Analisar Demo" → roster picker → /match/[id].
 * Após analisada, demo aparece em "Demos Analisadas" (/library).
 */
export default function MinhasDemosPage() {
  return <MatchesPageClient />;
}
