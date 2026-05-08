import Nav from "@/components/Nav";
import MatchesContent from "@/components/MatchesContent";

export const metadata = { title: "Match History · FragReel" };

/**
 * /matches — Sprint DEMO-3 Sprint 3 (08/05/2026).
 *
 * Página de match history web-based (paridade Allstar.gg). Usa Steam GC
 * sidecar dentro do client desktop pra puxar lista de matches
 * automaticamente — user nem precisa abrir CS2.
 *
 * 4 estados detectados via useSteamGCStatus:
 *   - "client_offline": user logado Steam OAuth mas client desktop não rodando
 *     → mostra preview empty + CTA download
 *   - "needs_credentials": client OK mas falta primeiro login Steam (credentials)
 *     → mostra SteamLoginModal CTA
 *   - "needs_auth_code": login OK mas falta match_sharing_auth_code 1x setup
 *     → mostra setup auth_code flow (link Steam page + paste code)
 *   - "ready": tudo conectado, match list popula via /api/steam/match-history
 *
 * Por que essa página existe (vs /library):
 *   /library mostra demos LOCAIS (já baixadas em csgo/replays/).
 *   /matches mostra TODAS as matches do user via Steam GC (sem CS2 abrir).
 *
 *   Eventualmente /library pode ser deprecado em favor de /matches, mas
 *   pra v1.0 mantém ambas — /library é fallback pra users sem DEMO-3
 *   conectado OU pra demos baixadas manualmente (HLTV, Faceit, etc).
 */
export default function MatchesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0" }}>
      <Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px 48px" }}>
        <MatchesContent />
      </div>
    </div>
  );
}
