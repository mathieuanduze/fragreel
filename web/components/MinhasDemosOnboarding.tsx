"use client";

/**
 * MinhasDemosOnboarding — banner "De onde vieram estas demos?" pra
 * primeira visita.
 *
 * Sprint v5.7.9 (08/05/2026 Mathieu spec): "ele vai achar que tá
 * pegando as últimas partidas dele e não as últimas que ele baixou,
 * tem que ser muito autoexplicativo".
 *
 * Mata o gap mental: user pensa "isso é tipo Allstar pegando minhas
 * últimas matches automático" — mas não, ele baixou cada uma no CS2.
 *
 * Comportamento:
 *   - Aparece se !isOnboardingDismissed("minhas_demos")
 *   - X dismiss → flag em localStorage → never shows again
 *   - Visual: bg laranja sutil + border + 3 bullets paralelos
 */

import { useEffect, useState } from "react";
import { X, ArrowUp, ArrowRight } from "lucide-react";
import {
  isOnboardingDismissed,
  dismissOnboarding,
} from "@/lib/onboarding";

export default function MinhasDemosOnboarding() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isOnboardingDismissed("minhas_demos"));
  }, []);

  function handleDismiss() {
    dismissOnboarding("minhas_demos");
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div
      className="rounded-xl border border-[#FF6B35]/20 bg-[#FF6B35]/[0.04] p-5 mb-4 relative"
    >
      <button
        onClick={handleDismiss}
        aria-label="Fechar"
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/85 hover:bg-white/5 transition-colors"
      >
        <X size={14} />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3 pr-8">
        <div className="text-2xl shrink-0 leading-none mt-0.5">👋</div>
        <h3 className="text-base font-bold text-white leading-tight">
          De onde vieram estas demos?
        </h3>
      </div>

      {/* Mata o gap mental — explicação em 2 frases */}
      <p className="text-[13px] text-white/75 leading-relaxed mb-4 max-w-3xl">
        Cada partida aqui é uma que <strong className="text-white">VOCÊ baixou no CS2</strong>.
        Não são suas últimas matches automáticas — são as que você
        marcou &ldquo;Download&rdquo; no jogo.
      </p>

      {/* Divider sutil */}
      <div className="h-px bg-white/[0.06] mb-3" />

      {/* 3 bullets paralelos */}
      <div className="space-y-2.5">
        <BulletRow
          icon={<ArrowRight size={14} className="text-[#FF6B35]" />}
          label="Pra fazer um reel"
        >
          Click em qualquer demo → escolha o player → seu reel fica pronto
        </BulletRow>

        <BulletRow
          icon={<ArrowRight size={14} className="text-[#FF6B35]" />}
          label="Faltou alguma partida sua?"
        >
          No CS2:{" "}
          <span className="text-white/85">Watch</span> →{" "}
          <span className="text-white/85">Your Matches</span> → clique{" "}
          <span className="text-white/85">Download</span> na partida que você quer
        </BulletRow>

        <BulletRow
          icon={<ArrowUp size={14} className="text-[#FF6B35]" />}
          label="Demo de pro player (HLTV/CSGOStats)?"
        >
          Use{" "}
          <span className="text-[#FF6B35] font-semibold">Importar .dem</span>{" "}
          lá em cima
        </BulletRow>
      </div>
    </div>
  );
}

function BulletRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-[12.5px]">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 leading-relaxed">
        <span className="font-semibold text-white">{label}</span>
        <span className="text-white/65"> · {children}</span>
      </div>
    </div>
  );
}
