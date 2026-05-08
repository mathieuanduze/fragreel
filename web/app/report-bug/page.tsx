"use client";

/**
 * /report-bug — Reportar bug (Sprint DEMO-3 v5, 08/05/2026 Mathieu spec).
 *
 * Form simples: título + descrição + opcional logs/screenshot. Envia pra
 * email do Mathieu via mailto: (MVP zero-infra) — depois migra pra
 * GitHub Issues API ou Discord webhook.
 */

import { useState } from "react";
import { Bug, Send, ExternalLink, MessageCircle } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReportBugPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    // MVP zero-infra: mailto: → user manda do Gmail/Outlook dele.
    // Próxima iteração: POST /api/report-bug → GitHub Issues + Discord.
    const subject = encodeURIComponent(`[FragReel Bug] ${title}`);
    const body = encodeURIComponent(
      `${description}\n\n---\nNavegador: ${navigator.userAgent}\nURL: ${window.location.href}`,
    );
    window.location.href = `mailto:mathieu@fragreel.gg?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  return (
    <AppShell
      title="Reportar bug"
      subtitle="Achou algo quebrado? Conta pra gente."
    >
      <div className="max-w-2xl space-y-4 mt-2">
        {submitted && (
          <Card className="p-4 border-emerald-500/30 bg-emerald-500/[0.05]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <Send size={16} className="text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">
                  Email aberto no seu app
                </div>
                <div className="text-xs text-white/55 mt-0.5">
                  Confirma o envio pelo seu cliente de email pra fechar o loop.
                </div>
              </div>
            </div>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Bug size={16} className="text-[#FF6B35]" />
              <h3 className="text-sm font-semibold text-white">
                Detalhes do bug
              </h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/65 mb-1.5">
                Título
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Render trava em 60% no Inferno"
                maxLength={140}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/60 focus:ring-2 focus:ring-[#FF6B35]/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/65 mb-1.5">
                O que aconteceu?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Passos pra reproduzir, screenshot, mensagem de erro, etc."
                rows={6}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/60 focus:ring-2 focus:ring-[#FF6B35]/20 transition resize-y"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-white/40 leading-relaxed max-w-md">
                Vai abrir seu cliente de email com tudo pré-preenchido + info
                do navegador.
              </p>
              <Button type="submit" disabled={!title.trim() || !description.trim()}>
                <Send size={14} />
                Enviar email
              </Button>
            </div>
          </Card>
        </form>

        {/* Outros canais */}
        <Card className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/45 mb-2">
            Outros canais
          </div>
          <div className="space-y-1.5">
            <a
              href="https://github.com/mathieuanduze/fragreel-client/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-white/70 hover:text-[#FF6B35] transition-colors"
            >
              <Bug size={14} />
              GitHub Issues
              <ExternalLink size={11} className="ml-auto opacity-50" />
            </a>
            <a
              href="https://discord.gg/fragreel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-white/70 hover:text-[#FF6B35] transition-colors"
            >
              <MessageCircle size={14} />
              Discord (em breve)
              <ExternalLink size={11} className="ml-auto opacity-50" />
            </a>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
