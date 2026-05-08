"use client";

/**
 * ImportDemoModal — explicar 2 fontes de demos + drag-drop manual.
 *
 * Sprint DEMO-3 v5 (08/05/2026 Mathieu spec):
 *   "temos que deixar claro no UX que são dois tipos diferentes de
 *    upload (baixar demo no cs ou upload)"
 *
 * Modal aberto via botão "Importar .dem" na topbar de /matches.
 * Mostra:
 *   - Card 1: Auto (CS2 Watch tab → baixa → aparece sozinha)
 *   - Card 2: Manual (drop .dem aqui de HLTV/CSGOStats/FACEIT)
 */

import { useRef, useState } from "react";
import {
  X,
  Download,
  UploadCloud,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileBox,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

const LOCAL_BASE = "http://127.0.0.1:5775";
const ACCEPTED = [".dem"];
const MAX_SIZE = 500 * 1024 * 1024;

type Phase = "idle" | "uploading" | "success" | "error";

export default function ImportDemoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function validate(file: File): string | null {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ACCEPTED.includes(ext)) return `Formato inválido. Aceita: ${ACCEPTED.join(", ")}`;
    if (file.size > MAX_SIZE) return "Arquivo > 500 MB";
    if (file.size < 50 * 1024) return "Arquivo muito pequeno (provavelmente corrompido)";
    return null;
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setErrorMsg(null);
    const err = validate(file);
    if (err) {
      setErrorMsg(err);
      setPhase("error");
      return;
    }
    setPhase("uploading");
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${LOCAL_BASE}/demos/import`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else if (xhr.status === 404) {
            reject(
              new Error(
                "Endpoint /demos/import indisponível. Atualize o client (v0.6.49+) ou drop o .dem direto na pasta replays/.",
              ),
            );
          } else reject(new Error(`upload_failed_${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("network_error"));
        xhr.send(fd);
      });
      setPhase("success");
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1200);
    } catch (e) {
      setErrorMsg((e as Error).message);
      setPhase("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-bold text-white">
              Importar uma demo .dem
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              Tem 2 jeitos — escolha o que faz mais sentido.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Source 1 — Auto via CS2 */}
          <Card className="p-4 border-emerald-500/20 bg-emerald-500/[0.03]">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Download size={16} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white">
                    Opção 1 — Baixar do CS2
                  </h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  Abra CS2 → <span className="text-white/85">Watch</span> →{" "}
                  <span className="text-white/85">Your Matches</span> → clique em{" "}
                  <span className="text-emerald-400">Download</span> na partida
                  desejada. CS2 salva o .dem em{" "}
                  <code className="text-[10px] text-emerald-400 bg-white/5 px-1 rounded">
                    csgo/replays/
                  </code>{" "}
                  e ele aparece sozinho na lista.
                </p>
              </div>
            </div>
          </Card>

          {/* Source 2 — Manual upload */}
          <Card
            className={`p-4 border-violet-500/20 bg-violet-500/[0.03] transition-all cursor-pointer ${
              drag ? "border-violet-500/60 bg-violet-500/[0.08]" : ""
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDrag(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            onClick={() => phase === "idle" && fileInput.current?.click()}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".dem"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <UploadCloud size={16} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white mb-1">
                  Opção 2 — Subir .dem externa
                </h3>
                <p className="text-xs text-white/60 leading-relaxed mb-3">
                  Demos de pro players ou matches que você não jogou. Drop o
                  arquivo aqui ou clique pra escolher.
                </p>

                {phase === "idle" && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <a
                      href="https://www.hltv.org/results"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:underline"
                    >
                      HLTV <ExternalLink size={9} />
                    </a>
                    <a
                      href="https://csgostats.gg/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:underline"
                    >
                      CSGOStats <ExternalLink size={9} />
                    </a>
                    <a
                      href="https://www.faceit.com/en/cs2/results"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:underline"
                    >
                      FACEIT <ExternalLink size={9} />
                    </a>
                    <span className="text-[10px] text-white/30 ml-auto font-mono">
                      <FileBox size={10} className="inline mr-1" />
                      .dem · max 500 MB
                    </span>
                  </div>
                )}

                {phase === "uploading" && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-white/65 truncate">
                      {fileName} · {progress}%
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-400 to-violet-300 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {phase === "success" && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                    <CheckCircle2 size={14} />
                    Demo importada! Atualizando lista...
                  </div>
                )}

                {phase === "error" && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-red-400 text-xs">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{errorMsg}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhase("idle");
                        setErrorMsg(null);
                      }}
                    >
                      Tentar de novo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-end">
          <button
            onClick={onClose}
            className="text-xs text-white/55 hover:text-white/80 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
