"use client";

/**
 * MatchesPageClient — "Minhas Demos" (Sprint DEMO-3 v4, 08/05/2026).
 *
 * Pivot v3 (Steam Web API + auth code) revertido. Volta pro fluxo
 * antigo simples:
 *   - Login Steam OpenID puro (já existente)
 *   - Lista demos LOCAIS via 127.0.0.1:5775/demos (mesma data source
 *     que /library tinha antes)
 *   - Per-card click → /demo/[sha] roster picker → /match/[id]
 *
 * Diferença vs /library hoje: em "Minhas Demos" mostramos TODAS as
 * .dem detectadas. Em "Demos Analisadas" filtramos só as com
 * `match_id` preenchido (já passaram pela IA).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./AppShell";
import LibraryContent from "./LibraryContent";
import { getUser, type SessionUser } from "@/lib/session";

export default function MatchesPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
    const onFocus = () => setUser(getUser());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (hydrated && !user) router.push("/login");
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <AppShell>
        <div className="space-y-3 mt-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-[88px] rounded-lg bg-white/[0.025] border border-white/[0.06] animate-pulse"
            />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Minhas Demos"
      subtitle={`Olá, ${user.name} · demos detectadas no seu PC`}
    >
      <LibraryContent />
    </AppShell>
  );
}
