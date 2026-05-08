import MatchesPageClient from "@/components/MatchesPageClient";

export const metadata = { title: "Match History · FragReel" };

/**
 * /matches — Sprint DEMO-3 v2 (08/05/2026).
 *
 * Página principal logada (substitui /library como home pós-login).
 * Sidebar layout estilo Linear/Allstar via AppShell.
 *
 * Single login: user já vem do Steam OAuth na LP. Match history puxa
 * via bot servidor Fly.io (DEMO-3 v2 — TODO em paralelo). MVP atual
 * mostra estados:
 *   - Não logado: redireciona /login
 *   - Logado, client offline: download CTA + preview cards
 *   - Logado, client online: match list (TODO bot servidor pra popular)
 */
export default function MatchesPage() {
  return <MatchesPageClient />;
}
