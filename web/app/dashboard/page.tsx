import { redirect } from "next/navigation";

/**
 * /dashboard foi descontinuado em v0.2.16 (B1 do redesign UX).
 *
 * O "histórico de FragReels gerados" deixou de fazer sentido quando a
 * gente unificou o fluxo em /library — toda demo aparece com o botão
 * "Mapear jogadas de impacto", sem distinção de "já processei antes"
 * vs "primeira vez".
 *
 * Mantemos esse route como redirect 307 pra não quebrar bookmarks ou
 * links antigos (ex: o próprio MatchClient linkava pra cá no
 * breadcrumb até o patch que reapontou pra /library).
 *
 * Quando todas as superfícies externas tiverem migrado (prazo arbitrário:
 * 6 meses), podemos deletar o route inteiro.
 */
export default function DashboardRedirect() {
  redirect("/library");
}
