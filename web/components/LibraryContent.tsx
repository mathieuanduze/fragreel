"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getLocalDemos,
  pingLocalClient,
  triggerLocalUpload,
  LocalClientOffline,
  LocalDemo,
} from "@/lib/local";
import { useClientVersionStatus } from "@/lib/useClientVersionStatus";
import AnalyzeModal from "./AnalyzeModal";
import UpdateRequiredModal from "./UpdateRequiredModal";

function fmtDate(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtRelative(epoch: number): string {
  const diffMs = Date.now() - epoch * 1000;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  if (days < 30) return `há ${Math.floor(days / 7)}sem`;
  return fmtDate(epoch);
}

// "de_dust2" -> "Dust 2", "de_mirage" -> "Mirage"
function prettyMap(raw: string): string {
  const cleaned = raw.replace(/^de_/, "");
  const special: Record<string, string> = {
    dust2: "Dust 2",
    cs_office: "Office",
  };
  if (special[cleaned]) return special[cleaned];
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// v0.3.1 (Sprint A3): game mode robusto vindo do server (parser detection
// via server_cvar mp_maxrounds + server_name + player count). Fallback pra
// heurística antiga só quando server_mode é null (demos legacy parseadas
// pré-v0.3.1, demos com cvars ausentes).
type GameModeServer =
  | "premier" | "competitive" | "wingman" | "casual"
  | "deathmatch" | "scrimmage" | null | undefined;

function matchType(
  scoreCt: number,
  scoreT: number,
  serverGameMode?: GameModeServer,
): { label: string; color: string } {
  // Server-provided game mode tem precedência absoluta — extraído de signals
  // confiáveis (mp_maxrounds + server_name + player count).
  if (serverGameMode) {
    const map: Record<string, { label: string; color: string }> = {
      premier:      { label: "Premier",          color: "#FF6B35" },
      competitive:  { label: "Competitivo",      color: "#FF6B35" },
      wingman:      { label: "Wingman",          color: "#a78bfa" },
      casual:       { label: "Casual",           color: "rgba(255,255,255,0.6)" },
      deathmatch:   { label: "Deathmatch",       color: "rgba(255,200,100,0.7)" },
      scrimmage:    { label: "Scrim / Outro",    color: "rgba(255,255,255,0.5)" },
    };
    return map[serverGameMode] ?? { label: "Outro", color: "rgba(255,255,255,0.5)" };
  }

  // Fallback: heurística antiga pra demos legacy (sem game_mode persistido).
  // Nota: ordem importa — testar Wingman ANTES de Premier pra evitar overlap
  // (Wingman MR8 max=8 vs Premier MR12 max=13).
  const total = scoreCt + scoreT;
  if (total === 0) return { label: "Em análise", color: "rgba(255,255,255,0.4)" };
  if (Math.max(scoreCt, scoreT) <= 8 && total >= 8 && total <= 16) {
    return { label: "Wingman?", color: "#a78bfa" };  // ? indica heurística incerta
  }
  if (Math.max(scoreCt, scoreT) >= 13) return { label: "Premier / Competitivo?", color: "#FF6B35" };
  if (total < 8) return { label: "Demo curta", color: "rgba(255,255,255,0.5)" };
  return { label: "Casual / Outro?", color: "rgba(255,255,255,0.5)" };
}

function fmtKD(k: number, d: number): string {
  if (d === 0) return k > 0 ? `${k.toFixed(1)}` : "—";
  return (k / d).toFixed(2);
}

export default function LibraryContent() {
  const router = useRouter();
  const [demos, setDemos] = useState<LocalDemo[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAnalyze, setActiveAnalyze] = useState<{ sha: string; mapName: string } | null>(null);
  // Gate de versão: aplica o MESMO bloqueio que MatchClient antes de
  // qualquer ação que dispara render/upload no client antigo. Sem esse
  // gate na biblioteca (regressão v0.2.10), o user clicava "Gerar
  // FragReel" e o client desatualizado começava a processar com bugs
  // já corrigidos antes do MatchClient ter chance de barrar.
  const clientVersion = useClientVersionStatus();
  const [updatePrompt, setUpdatePrompt] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setOffline(false);
    setError(null);
    try {
      const r = await getLocalDemos(refresh);
      setDemos(r.matches);
      setScanning(r.scanning);
      setScanDone(r.scan_done);
      if (r.error) setError(r.error);
    } catch (e) {
      if (e instanceof LocalClientOffline) setOffline(true);
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  // Enquanto o scan tá rolando no client, o /demos já retorna imediatamente
  // com scanning=true. Polling leve a cada 2.5s atualiza a UI quando o
  // bg-thread terminar — sem disparar novo scan (refresh=false).
  // Importante: NÃO depender de scan_done aqui — quando o user clica "Re-escanear"
  // após um scan já feito, o servidor responde {scanning:true, scan_done:true}
  // (scan anterior estava done, novo começou). Se condicionasse a !scanDone, o
  // botão ficaria preso em "Escaneando…" pra sempre.
  useEffect(() => {
    if (!scanning || offline) return;
    let alive = true;
    const id = setInterval(async () => {
      if (!alive) return;
      try {
        const r = await getLocalDemos(false);
        if (!alive) return;
        setDemos(r.matches);
        setScanning(r.scanning);
        setScanDone(r.scan_done);
        if (r.error) setError(r.error);
      } catch (e) {
        if (e instanceof LocalClientOffline) {
          setOffline(true);
          setScanning(false);
        }
      }
    }, 2500);
    return () => { alive = false; clearInterval(id); };
  }, [scanning, offline]);

  // Se a página renderizou em estado offline (user abriu /library antes de
  // ligar o .exe), pinga /health a cada 4s e dispara load() automaticamente
  // assim que o client aparecer — sem precisar clicar em "Recarregar".
  useEffect(() => {
    if (!offline) return;
    let alive = true;
    const id = setInterval(async () => {
      const ok = await pingLocalClient();
      if (alive && ok) {
        clearInterval(id);
        load(false);
      }
    }, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [offline, load]);

  // Bug 4 (v0.2.11 PC testing): se o client morrer DURANTE a sessão (silent
  // death pós-idle, kill manual, etc), as demos continuavam visíveis em cache
  // do React e o user clicava em ações que falhavam silenciosamente. O
  // useClientVersionStatus já polla /health a cada 8s — espelhamos o status
  // aqui pra esconder os cards e mostrar o CTA de reinstall logo que o
  // client some. Só sincroniza ONLINE→OFFLINE; o caminho contrário é tratado
  // pelo effect acima (pingLocalClient + load).
  useEffect(() => {
    if (clientVersion.status === "offline" && !offline) {
      setOffline(true);
    }
  }, [clientVersion.status, offline]);

  // Bug 2 (v0.2.11 PC testing): após auto-update, a versão local muda de
  // v0.2.10 → v0.2.11, mas a lista de demos vinha do cache do React stale e
  // não refletia o estado novo (user precisava F5 manual). Quando detectamos
  // que `clientVersion.local` mudou pra um valor não-nulo (ou seja, o client
  // voltou ao ar com nova versão), forçamos refresh do /demos.
  const lastLocalVersion = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastLocalVersion.current;
    const curr = clientVersion.local;
    // Só reaja a transições real prev→curr com curr definido. Ignora o
    // primeiro tick (prev null + curr null = boot).
    if (curr && prev && prev !== curr && !offline) {
      load(true);
    }
    lastLocalVersion.current = curr;
  }, [clientVersion.local, offline, load]);

  // Dispara a pipeline client → backend (upload + detect + mapear plays).
  //
  // v0.2.16 unificou o fluxo: toda demo (processada ou não) passa por
  // aqui. Antes existiam 2 caminhos — "Editar FragReel" (pulava direto
  // pra /match/{id} com getMatch() validando 404) e "Mapear plays"
  // (re-upload). A distinção expunha um bug quando o match_id local
  // apontava pra um job garbage-collected no servidor: o /match/{id}
  // carregava mas o polling de /jobs/{sha} ficava eterno. Unificando
  // tudo via triggerLocalUpload + AnalyzeModal, o backend decide:
  //   - demo já processada com job vivo → cache HIT fast-path (~1s)
  //   - demo não processada → pipeline completa (~30s)
  //   - demo processada mas job expirou → re-análise (como se 1ª vez)
  // O user vê a mesma UX nos 3 casos: modal de análise → abre /match/{id}.
  //
  // Além disso mata o "✏️ Editar FragReel" do menu que estava confundindo
  // (B1 do redesign UX): demo aparece = mapear jogadas de impacto, ponto.
  const triggerReupload = useCallback(async (demo: LocalDemo) => {
    try {
      await triggerLocalUpload(demo.sha1);
      setActiveAnalyze({ sha: demo.sha1, mapName: demo.map_name });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const onPick = async (demo: LocalDemo) => {
    // Hard gate: client desatualizado nunca passa daqui. Sem esse check
    // o user antigo conseguia clicar e o client começava a uploadar/
    // renderizar com bugs já corrigidos antes do MatchClient ter chance
    // de barrar (bug reportado no v0.2.10 testing).
    if (clientVersion.status === "outdated") {
      setUpdatePrompt(true);
      return;
    }
    await triggerReupload(demo);
  };

  if (offline) {
    return (
      <div style={{ padding: 40, textAlign: "center", border: "1px solid #2D2D44", borderRadius: 12, background: "#13131f" }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>🖥️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>FragReel client não detectado</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", maxWidth: 460, margin: "0 auto 20px" }}>
          Pra ver suas partidas, instale e abra o FragReel no seu PC. Ele lê suas demos do CS2 localmente — nada é enviado sem sua confirmação.
        </div>
        <a href="/download" className="btn-primary" style={{ fontSize: 14, padding: "10px 22px", textDecoration: "none" }}>
          ⬇ Baixar client
        </a>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => load(false)} className="btn-secondary" style={{ fontSize: 13, padding: "8px 18px" }}>
            Já está aberto · Recarregar
          </button>
        </div>
      </div>
    );
  }

  // Antes do primeiro snapshot — só uma mensagem neutra.
  if (loading && !demos) {
    return <div style={{ padding: 40, color: "rgba(255,255,255,0.55)" }}>Conectando ao client…</div>;
  }

  // Se o erro de scan é "client não rodando" (string vinda do backend ou edge case),
  // tratamos como offline pra mostrar o CTA de download em vez de mensagem de erro crua.
  if (error && /client.*n[aã]o.*rodando|ECONNREFUSED|offline/i.test(error)) {
    return (
      <div style={{ padding: 40, textAlign: "center", border: "1px solid #2D2D44", borderRadius: 12, background: "#13131f" }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>🖥️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>FragReel client parou de responder</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", maxWidth: 460, margin: "0 auto 20px" }}>
          O scan tentou rodar mas o client não respondeu. Reabra o FragReel.exe — se não tiver instalado, baixe abaixo.
        </div>
        <a href="/download" className="btn-primary" style={{ fontSize: 14, padding: "10px 22px", textDecoration: "none" }}>
          ⬇ Baixar / Reinstalar client
        </a>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => load(false)} className="btn-secondary" style={{ fontSize: 13, padding: "8px 18px" }}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (error && !demos?.length) {
    return (
      <div style={{ padding: 24, color: "#ff8866", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Erro no scan</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>{error}</div>
        <a href="/download" className="btn-primary" style={{ fontSize: 13, padding: "8px 16px", textDecoration: "none" }}>
          ⬇ Reinstalar client
        </a>
      </div>
    );
  }

  const busy = loading || scanning;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          {scanning && !scanDone
            ? "Escaneando suas demos no PC… (pode levar alguns minutos na 1ª vez)"
            : `${demos?.length ?? 0} partidas detectadas no seu PC`}
        </div>
        <button
          onClick={() => load(true)}
          disabled={busy}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "9px 18px",
            borderRadius: 8,
            background: "rgba(255,107,53,0.12)",
            color: "#FF6B35",
            border: "1px solid rgba(255,107,53,0.45)",
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,107,53,0.20)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,107,53,0.12)"; }}
        >
          <span style={{ fontSize: 14 }}>↻</span>
          {busy ? "Escaneando..." : "Re-escanear demos"}
        </button>
      </div>

      {error && demos && demos.length > 0 && (
        <div style={{ padding: 12, marginBottom: 12, fontSize: 13, color: "#ffb088", border: "1px solid rgba(255,150,80,0.35)", borderRadius: 8, background: "rgba(255,150,80,0.06)" }}>
          Aviso do client: {error}
        </div>
      )}

      {/* Sem demos + scan terminado = realmente vazio. Sem demos + scan rolando = placeholder de progresso. */}
      {(!demos || demos.length === 0) && (
        scanDone ? (
          <div style={{ padding: 28, textAlign: "center", color: "rgba(255,255,255,0.5)", border: "1px dashed #2D2D44", borderRadius: 12 }}>
            Nenhuma demo encontrada. Jogue uma partida competitiva ou baixe uma demo do HLTV pra começar.
          </div>
        ) : (
          <div style={{ padding: 28, textAlign: "center", color: "rgba(255,255,255,0.5)", border: "1px dashed #2D2D44", borderRadius: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            Lendo .dem do CS2… isso roda só localmente, nada é enviado.
          </div>
        )
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {(demos || []).map((d) => {
          // v0.3.1 (Sprint A2 follow-up, Mathieu 25/04): badge de game mode
          // removida do card. Por hora tudo é competitivo então a tag
          // adicionava ruído. matchType() permanece definida no arquivo
          // pra recuperar quando voltar a fazer sentido (multi-mode
          // support no Sprint C2 de Steam discovery, por exemplo).
          // Linha abaixo deliberadamente comentada em vez de deletada
          // pra reduzir delta do diff caso seja desfeito:
          // const type = matchType(d.score_ct, d.score_t, undefined);
          const totalRounds = d.score_ct + d.score_t;
          const kd = fmtKD(d.player_kills, d.player_deaths);
          const mapPretty = prettyMap(d.map_name);
          // Tentativa de usar imagem do mapa; fallback pra gradiente se não existir.
          const mapImg = `/maps/${d.map_name}.png`;

          const isProcessed = !!d.match_id;
          return (
            <div key={d.sha1} style={{
              background: "#13131f",
              border: isProcessed ? "1px solid rgba(91,227,143,0.45)" : "1px solid #2D2D44",
              borderRadius: 12,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              transition: "border-color 0.15s, transform 0.15s",
            }}>
              {/* Header com thumb do mapa */}
              <div style={{
                position: "relative",
                height: 96,
                background: `linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)`,
                overflow: "hidden",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapImg}
                  alt={mapPretty}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    opacity: 0.4,
                  }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(180deg, rgba(19,19,31,0.2) 0%, rgba(19,19,31,0.95) 100%)",
                }} />
                <div style={{
                  position: "absolute", top: 10, left: 12, right: 12,
                  display: "flex", justifyContent: "flex-end", alignItems: "flex-start",
                }}>
                  {/* v0.3.1 (Sprint A2 follow-up, Mathieu 25/04): badge de
                      game mode (Premier/Wingman/Casual) removida — por hora
                      tudo é competitivo, tag adiciona ruído visual sem
                      semântica útil. Detection no server (parser.game_mode)
                      mantida pra quando voltar a fazer sentido (multi-mode
                      support, separação Premier/MM no flow de discovery, etc).
                      Lado direito do card mantém timestamp + indicador
                      isProcessed. */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {/* v0.3.1 (Sprint A2): badge "FragReel pronto" removida.
                       Pivot v0.2.x pro modelo on-demand removeu o conceito —
                       não existe mais "FragReel pré-renderizado", todo render
                       é local sob demanda. `isProcessed` continua significando
                       "demo já analisada pelo server (highlights extraídos)" —
                       UX disso fica na border-color + helper text abaixo. */}
                    <span
                      title={new Date(d.mtime * 1000).toLocaleString("pt-BR")}
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}
                    >
                      {fmtRelative(d.mtime)}
                    </span>
                  </div>
                </div>
                <div style={{
                  position: "absolute", bottom: 10, left: 14,
                  fontWeight: 800, fontSize: 20, color: "#E8E8F0",
                  letterSpacing: "-0.02em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}>{mapPretty}</div>
              </div>

              {/* Stats grid */}
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                }}>
                  {/* Placar */}
                  <div
                    title="Placar final do seu time (CT–TR)"
                    style={{
                      padding: "8px 10px",
                      background: "#0d0d1a",
                      border: "1px solid #2D2D44",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                      Placar
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: totalRounds > 0 ? "#E8E8F0" : "rgba(255,255,255,0.3)" }}>
                      {totalRounds > 0 ? `${d.score_ct}–${d.score_t}` : "—"}
                    </div>
                  </div>

                  {/* K/D kills/mortes */}
                  <div
                    title={`${d.player_kills} kills em ${d.player_deaths} mortes`}
                    style={{
                      padding: "8px 10px",
                      background: "#0d0d1a",
                      border: "1px solid #2D2D44",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                      K / D
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#E8E8F0" }}>
                      {d.player_kills}<span style={{ color: "rgba(255,255,255,0.3)" }}> / </span>{d.player_deaths}
                    </div>
                  </div>

                  {/* Ratio */}
                  <div
                    title="Proporção kills por morte — acima de 1.0 = positivo"
                    style={{
                      padding: "8px 10px",
                      background: "#0d0d1a",
                      border: "1px solid #2D2D44",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                      Ratio
                    </div>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: d.player_kills > d.player_deaths ? "#5be38f" : d.player_kills < d.player_deaths ? "#ff7066" : "#E8E8F0",
                    }}>
                      {kd}
                    </div>
                  </div>
                </div>

                {/* Metadados do arquivo */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: "rgba(255,255,255,0.35)",
                  paddingTop: 2,
                }}>
                  <span title="Tamanho do arquivo .dem">
                    📦 {d.size_mb} MB
                  </span>
                  <span title={`Rounds jogados nessa partida: ${totalRounds}`}>
                    {totalRounds} rounds
                  </span>
                  <span title="Identificador local da demo (SHA1 do arquivo)">
                    #{d.sha1.slice(0, 6)}
                  </span>
                </div>

                {/* CTA único v0.2.16 (B1 do redesign UX):
                    Antes tinha 2 botões diferentes — "Mapear plays" pra
                    demo nova e "Editar FragReel" pra demo já processada.
                    A dualidade confundia e expunha um bug quando o
                    match_id apontava pra job garbage-collected no
                    servidor (UI travava em "⏳ Re-analisando" infinito).
                    Decisão do user: demo aparece = mapear jogadas, ponto.
                    O backend decide se re-processa ou usa cache HIT
                    fast-path — a UI é a mesma nos 2 casos. */}
                <button
                  onClick={() => onPick(d)}
                  className="btn-primary"
                  style={{ fontSize: 13, padding: "10px 18px", marginTop: 2 }}
                >
                  🎯 Mapear jogadas de impacto
                </button>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.4 }}>
                  {isProcessed
                    ? "Demo já processada · abre rápido no seletor de formato"
                    : "A IA detecta ACEs, clutches e multi-kills · ~30s · você escolhe o formato depois"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeAnalyze && (
        <AnalyzeModal
          sha={activeAnalyze.sha}
          mapName={activeAnalyze.mapName}
          onClose={() => setActiveAnalyze(null)}
          onReady={(matchId) => {
            setActiveAnalyze(null);
            router.push(`/match/${matchId}`);
          }}
        />
      )}

      {/* Modal bloqueante de update — sem ele, o `setUpdatePrompt(true)`
          dispara em onPick/onRegenerate mas nada aparece pro user. Foi
          o bug do v0.2.10: gate lógico existia no MatchClient, faltou
          o render aqui na biblioteca. */}
      {updatePrompt && (
        <UpdateRequiredModal
          localVersion={clientVersion.local}
          onClose={() => setUpdatePrompt(false)}
        />
      )}
    </div>
  );
}
