"use client";

/**
 * /setup-steam — Sprint DEMO-3 v3 (2026-05-08).
 *
 * Bootstrap one-time pra Opção B (Steam Web API GetNextMatchSharingCode).
 * Substitui setup do bot 24/7. User cola 2 strings, FragReel walks daí.
 *
 * Layout: AppShell + 2 cards step-by-step (Linear/Vercel polidez, paleta
 * gamer hybrid).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, ExternalLink, KeyRound, Trophy } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUser, type SessionUser } from "@/lib/session";
import {
  isValidAuthCode,
  isValidSharecode,
  setSteamAuthSetup,
  getSteamAuthSetup,
} from "@/lib/steam-auth";

export default function SetupSteamPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [sharecode, setSharecode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUser());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !user) router.push("/login");
  }, [hydrated, user, router]);

  // Se já tem setup, redireciona pra /matches (a menos que ?force=1).
  useEffect(() => {
    if (!hydrated || !user) return;
    const force = new URLSearchParams(window.location.search).has("force");
    if (!force && getSteamAuthSetup()) {
      router.replace("/matches");
    }
  }, [hydrated, user, router]);

  const authCodeValid = useMemo(() => isValidAuthCode(authCode), [authCode]);
  const sharecodeValid = useMemo(() => isValidSharecode(sharecode), [sharecode]);
  const canSubmit = authCodeValid && sharecodeValid && !submitting;

  const matchTokenUrl = user
    ? `https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128`
    : "https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128";

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      setSteamAuthSetup({
        authCode: authCode.trim().toUpperCase(),
        anchorSharecode: sharecode.trim().toUpperCase(),
      });
      router.push("/matches");
    } catch (e) {
      setError((e as Error).message || "unknown_error");
      setSubmitting(false);
    }
  }

  if (!hydrated || !user) {
    return <AppShell>{null}</AppShell>;
  }

  return (
    <AppShell
      title="Conectar Steam"
      subtitle="Setup único pra ver suas partidas — leva 30 segundos"
    >
      <div className="max-w-3xl mx-auto space-y-4 mt-2">
        {/* Intro */}
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-[#FF6B35]/10 via-transparent to-[#5D9CEC]/5 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#FF6B35]/15 p-2">
              <Trophy size={20} className="text-[#FF6B35]" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white">
                Por que precisamos disso?
              </h2>
              <p className="text-sm text-white/60 mt-1 leading-relaxed">
                A Valve não expõe seu histórico de partidas via login Steam
                normal. Pra puxar suas matches automaticamente, a gente usa
                a API oficial deles, que pede 2 strings — você cola 1 vez e
                pronto. Mesmo padrão de Allstar, Leetify e cs-demo-manager.
              </p>
            </div>
          </div>
        </div>

        {/* Step 1 — Auth code */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="subtle" className="font-mono">1</Badge>
            <h3 className="text-base font-semibold text-white">Auth code do Steam</h3>
            <KeyRound size={14} className="text-white/40 ml-auto" />
          </div>

          <ol className="text-sm text-white/70 space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2">
              <span className="text-[#FF6B35]">•</span>
              <span>
                Abre a página do Steam em{" "}
                <a
                  href={matchTokenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#5D9CEC] hover:underline inline-flex items-center gap-1"
                >
                  help.steampowered.com
                  <ExternalLink size={11} />
                </a>{" "}
                logado na conta que joga CS2
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#FF6B35]">•</span>
              <span>Procura por &ldquo;Match Token&rdquo; ou &ldquo;Authentication Code&rdquo;</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#FF6B35]">•</span>
              <span>Copia o código (formato <code className="text-white/90 bg-white/5 px-1 rounded">XXXX-XXXXX-XXXX</code>) e cola abaixo</span>
            </li>
          </ol>

          <div className="relative">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="ABCD-EFGHI-JKLM"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/60 focus:ring-2 focus:ring-[#FF6B35]/20 transition"
            />
            {authCode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {authCodeValid ? (
                  <Check size={16} className="text-emerald-400" />
                ) : (
                  <span className="text-xs text-amber-400">Formato inválido</span>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Step 2 — Sharecode âncora */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="subtle" className="font-mono">2</Badge>
            <h3 className="text-base font-semibold text-white">Sharecode da última partida</h3>
            <Copy size={14} className="text-white/40 ml-auto" />
          </div>

          <ol className="text-sm text-white/70 space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2">
              <span className="text-[#5D9CEC]">•</span>
              <span>Abre o CS2 → vai em <span className="text-white/90">Watch</span> → <span className="text-white/90">Your Matches</span></span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#5D9CEC]">•</span>
              <span>Clica em qualquer partida recente → botão <span className="text-white/90">Copy share code</span></span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#5D9CEC]">•</span>
              <span>Cola abaixo (formato <code className="text-white/90 bg-white/5 px-1 rounded">CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX</code>)</span>
            </li>
          </ol>

          <div className="relative">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={sharecode}
              onChange={(e) => setSharecode(e.target.value)}
              placeholder="CSGO-ABCDE-FGHIJ-KLMNO-PQRST-UVWXY"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus:border-[#5D9CEC]/60 focus:ring-2 focus:ring-[#5D9CEC]/20 transition"
            />
            {sharecode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {sharecodeValid ? (
                  <Check size={16} className="text-emerald-400" />
                ) : (
                  <span className="text-xs text-amber-400">Formato inválido</span>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-white/40 mt-3 leading-relaxed">
            A partir desse sharecode, o FragReel descobre todas as partidas
            posteriores automaticamente. Você não precisa colar de novo.
          </p>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-white/40">
            Strings ficam salvas só no seu navegador (localStorage).
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="lg"
            className="min-w-[180px]"
          >
            {submitting ? "Salvando..." : (
              <>
                Conectar
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>
    </AppShell>
  );
}
