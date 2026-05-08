"use client";

/**
 * /upload — Sprint DEMO-3 v3 (08/05/2026 Mathieu spec).
 *
 * "Upload demo (para fazer upload direto de demo externa)" — tab nova
 * no sidebar pra ingerir .dem de fora (HLTV, CSGOStats, FACEIT, etc).
 *
 * UX MVP atual (em construção):
 *  - Drag-and-drop area (UI completo)
 *  - Browser lê o arquivo via File API
 *  - POST pro local client em 127.0.0.1:5775/demos/import (endpoint
 *    a implementar no client v0.6.49+)
 *  - Quick links HLTV / CSGOStats / FACEIT
 *  - Fallback manual: mostra path da pasta replays/ pra copiar arquivo
 *    direto se client sem endpoint
 *
 * Depois do import bem-sucedido, redirect pra /library.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertCircle,
  FileBox,
  ArrowRight,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientVersionStatus } from "@/lib/useClientVersionStatus";

const LOCAL_BASE = "http://127.0.0.1:5775";
const ACCEPTED_EXTENSIONS = [".dem"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB — competitive demos ficam ~50-200MB

type Phase = "idle" | "validating" | "uploading" | "success" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clientStatus = useClientVersionStatus();

  const [dragActive, setDragActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const clientOnline = clientStatus.status === "current";

  function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Formato não suportado. Aceita: ${ACCEPTED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${MAX_FILE_SIZE / 1024 / 1024} MB`;
    }
    if (file.size < 50 * 1024) {
      return "Arquivo muito pequeno — provavelmente corrompido ou .dem inválido";
    }
    return null;
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setErrorMsg(null);

    const validationError = validateFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      setPhase("error");
      return;
    }

    if (!clientOnline) {
      setErrorMsg("Client FragReel offline. Inicia o client antes de subir demo.");
      setPhase("error");
      return;
    }

    setPhase("uploading");
    setProgress(0);

    try {
      // POST pro endpoint do client local. Se 404, mostra fallback manual.
      const formData = new FormData();
      formData.append("file", file, file.name);

      // Use XHR pra ter progress real (fetch API ainda não tem upload progress)
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
                "client_endpoint_missing — atualiza pra v0.6.49+ ou move o .dem manualmente",
              ),
            );
          } else reject(new Error(`upload_failed_${xhr.status}: ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error("network_error"));
        xhr.send(formData);
      });

      setPhase("success");
      setTimeout(() => router.push("/library"), 1200);
    } catch (e) {
      setErrorMsg((e as Error).message);
      setPhase("error");
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <AppShell
      title="Upload Demo"
      subtitle="Ingerir .dem externa de HLTV / CSGOStats / FACEIT"
    >
      <div className="max-w-3xl mx-auto space-y-4 mt-2">
        {/* Drop zone */}
        <Card
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`relative overflow-hidden p-10 transition-all cursor-pointer ${
            dragActive
              ? "border-[#FF6B35]/60 bg-[#FF6B35]/[0.06]"
              : "hover:border-white/15 hover:bg-white/[0.02]"
          } ${phase === "uploading" ? "pointer-events-none" : ""}`}
          onClick={() => phase === "idle" && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".dem"
            onChange={handleSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center text-center">
            {phase === "idle" && (
              <>
                <div className="h-14 w-14 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center mb-4">
                  <UploadCloud size={28} className="text-[#FF6B35]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1.5">
                  Solta tua .dem aqui
                </h3>
                <p className="text-sm text-white/55 max-w-sm leading-relaxed">
                  Ou clica pra escolher um arquivo. Aceita .dem CS2/CS:GO até 500MB.
                </p>
                <div className="flex items-center gap-2 mt-4 text-[11px] text-white/40 font-mono">
                  <FileBox size={12} />
                  <span>.dem · max 500 MB</span>
                </div>
              </>
            )}

            {phase === "validating" && (
              <>
                <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 animate-pulse">
                  <FileBox size={28} className="text-white/60" />
                </div>
                <p className="text-sm text-white/70">Validando {fileName}...</p>
              </>
            )}

            {phase === "uploading" && (
              <div className="w-full max-w-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center shrink-0">
                    <UploadCloud size={18} className="text-[#FF6B35]" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {fileName}
                    </div>
                    <div className="text-xs text-white/55">
                      {progress}% enviado
                    </div>
                  </div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FF8E53] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {phase === "success" && (
              <>
                <div className="h-14 w-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1.5">
                  Demo enviada!
                </h3>
                <p className="text-sm text-white/55 max-w-sm">
                  Redirecionando pra Demos Analisadas...
                </p>
              </>
            )}

            {phase === "error" && (
              <>
                <div className="h-14 w-14 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                  <AlertCircle size={28} className="text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1.5">
                  Falha no upload
                </h3>
                <p className="text-sm text-red-400/85 max-w-md mb-4">
                  {errorMsg}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhase("idle");
                    setErrorMsg(null);
                    setFileName(null);
                  }}
                >
                  Tentar de novo
                </Button>
              </>
            )}
          </div>
        </Card>

        {/* Status do client */}
        <ClientStatusInline online={clientOnline} checking={clientStatus.status === "checking"} />

        {/* Fallback manual + sources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download size={14} className="text-[#5D9CEC]" />
              <h4 className="text-sm font-semibold text-white">
                Onde achar demos
              </h4>
            </div>
            <ul className="space-y-1.5 text-[13px] text-white/65">
              <li>
                <a
                  href="https://www.hltv.org/results"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#FF6B35] transition-colors"
                >
                  HLTV.org · Pro matches <ExternalLink size={11} />
                </a>
              </li>
              <li>
                <a
                  href="https://csgostats.gg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#FF6B35] transition-colors"
                >
                  CSGOStats · MM demos <ExternalLink size={11} />
                </a>
              </li>
              <li>
                <a
                  href="https://www.faceit.com/en/cs2/results"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#FF6B35] transition-colors"
                >
                  FACEIT · Premier matches <ExternalLink size={11} />
                </a>
              </li>
            </ul>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileBox size={14} className="text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">
                Alternativa manual
              </h4>
            </div>
            <p className="text-[13px] text-white/65 leading-relaxed">
              Move o .dem direto pra pasta{" "}
              <code className="text-[11px] text-[#FF6B35] bg-white/5 px-1 py-0.5 rounded font-mono">
                Steam/.../730/replays/
              </code>{" "}
              e ele aparece automático em{" "}
              <a
                onClick={(e) => {
                  e.preventDefault();
                  router.push("/library");
                }}
                className="inline-flex items-center gap-1 text-[#FF6B35] hover:underline cursor-pointer"
              >
                Demos Analisadas <ArrowRight size={11} />
              </a>
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function ClientStatusInline({
  online,
  checking,
}: {
  online: boolean;
  checking: boolean;
}) {
  if (checking) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/45 px-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Verificando client...
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            online ? "bg-emerald-400" : "bg-orange-400"
          }`}
        />
        <span className="text-white/55">
          Client FragReel{" "}
          <span className={online ? "text-emerald-400" : "text-orange-400"}>
            {online ? "online" : "offline"}
          </span>
        </span>
      </div>
      {!online && <Badge variant="warning">Inicia o client pra subir demo</Badge>}
    </div>
  );
}
