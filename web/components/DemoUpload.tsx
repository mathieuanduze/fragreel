"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDemo } from "@/lib/api";
import { getUser } from "@/lib/session";

type State = "idle" | "uploading" | "processing" | "done" | "error";

export default function DemoUpload({ onUploaded }: { onUploaded?: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [matchId, setMatchId] = useState("");
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".dem")) {
      setMessage("Selecione um arquivo .dem válido (demo do CS2).");
      setState("error");
      return;
    }

    setState("uploading");
    setProgress(0);
    setMessage("");

    try {
      const user = getUser();
      const steamid = user?.steamid ?? "";

      const result = await uploadDemo(file, steamid, (pct) => setProgress(pct));

      setState("processing");
      setMatchId(result.match_id);

      if (result.status === "parsed") {
        setMessage(`${result.highlights ?? 0} highlights encontrados em ${result.map ?? "mapa desconhecido"}.`);
      } else {
        setMessage("Demo recebida! Processamento em andamento...");
      }

      setState("done");
      onUploaded?.();
    } catch (e: unknown) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Erro ao enviar a demo. Tente novamente.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function reset() {
    setState("idle");
    setProgress(0);
    setMessage("");
    setMatchId("");
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (state === "done") {
    return (
      <div style={{
        padding: "20px 24px",
        background: "rgba(52,211,153,0.06)",
        border: "1px solid rgba(52,211,153,0.25)",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Demo processada!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{message}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {matchId && (
            <button
              onClick={() => router.push(`/match/${matchId}`)}
              className="btn-primary"
              style={{ fontSize: 13, padding: "8px 18px" }}
            >
              🎬 Ver highlights
            </button>
          )}
          <button
            onClick={reset}
            style={{
              fontSize: 13,
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid #2D2D44",
              borderRadius: 8,
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
            }}
          >
            Enviar outra
          </button>
        </div>
      </div>
    );
  }

  // ── Uploading / processing state ────────────────────────────────────────────
  if (state === "uploading" || state === "processing") {
    return (
      <div style={{
        padding: "20px 24px",
        background: "#16213E",
        border: "1px solid #2D2D44",
        borderRadius: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 20 }}>⚙️</span>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {state === "uploading" ? `Enviando demo... ${progress}%` : "Processando highlights..."}
          </div>
        </div>
        <div style={{ height: 6, background: "#1A1A2E", borderRadius: 99, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${state === "processing" ? 100 : progress}%`,
            background: state === "processing"
              ? "linear-gradient(90deg, #FF6B35, #a78bfa)"
              : "#FF6B35",
            borderRadius: 99,
            transition: "width 0.3s ease",
            animation: state === "processing" ? "pulse 1.5s ease-in-out infinite" : "none",
          }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          {state === "processing" ? "A IA está analisando seus frags..." : "Aguarde, arquivos grandes levam alguns segundos"}
        </div>
      </div>
    );
  }

  // ── Idle / error state ──────────────────────────────────────────────────────
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".dem"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "28px 24px",
          background: dragging ? "rgba(255,107,53,0.06)" : "#16213E",
          border: `2px dashed ${dragging ? "#FF6B35" : state === "error" ? "#E05555" : "#2D2D44"}`,
          borderRadius: 14,
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
          Arraste o arquivo .dem aqui
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>
          ou clique para selecionar do computador
        </div>

        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          background: "#1A1A2E",
          border: "1px solid #2D2D44",
          borderRadius: 8,
          fontSize: 12,
          color: "rgba(255,255,255,0.35)",
          fontFamily: "monospace",
        }}>
          📂 Steam / steamapps / common / CS2 / game / csgo / replays /
        </div>

        {state === "error" && (
          <div style={{ marginTop: 12, fontSize: 13, color: "#E05555" }}>
            ⚠️ {message}
          </div>
        )}
      </div>
    </div>
  );
}
