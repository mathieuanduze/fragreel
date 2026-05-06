// Espelho do MatchOut / HighlightOut do api/models.py
// Se mudar lá, atualizar aqui.
import type { Orientation } from "./theme";

export type Mood = "eletronica" | "acao" | "heroico" | "chill";

// Re-exporta pra quem importa só de types.
export type { Orientation };

/** Sprint Aesthetic Kill Scoring (06/05) — visual style aplicado em cima
 *  das kills mais bonitas. Editor renderiza efeito específico por tipo:
 *    - noscope:  AWP sem zoom → flash dourado + zoom suave
 *    - knife:    knife kill → color grade quente + screen shake leve
 *    - wallbang: bullet penetrou parede → flash branco + x-ray pulse
 *    - smoke:    tiro através de smoke → flash azul claro
 *    - blind:    atacante cego → flash branco overpower
 *    - flick:    high score genérico → flash laranja (Sprint #6.1 effect)
 *    - null:     kill comum, sem efeito visual extra
 */
export type KillAestheticStyle = "noscope" | "knife" | "wallbang" | "smoke" | "blind" | "flick" | null;

export type Kill = {
  label: string;
  weapon: string;
  headshot: boolean;
  hp: number;
  // Tempo da kill em segundos relativo ao início do MATCH (mesma base de highlight.start/end).
  // Opcional: quando o parser não fornece, o editor estima distribuindo
  // uniformemente as N kills entre highlight.start e highlight.end.
  time?: number;
  // Round 4c Fase 1.23 — narrative context pro título dinâmico
  // (Mathieu spec: "imita CS HUD"). Editor mostra
  // "{alive_ct_after}v{alive_t_after} · {attacker_health}HP" evoluindo
  // dinamicamente com cada kill. Todos opcionais — fallback pro
  // "{N} KILLS" da Fase 1.21 quando undefined (highlights legados).
  attacker_health?: number;
  alive_ct_after?: number;
  alive_t_after?: number;
  /** Sprint Aesthetic (06/05) — score técnico/estético da kill. Editor
   *  usa pra threshold de cinematic effect. Highlights legados sem este
   *  field default 0 (treated as common kill). */
  aesthetic_score?: number;
  /** Sprint Aesthetic (06/05) — style hint pro editor. null/undefined =
   *  kill comum sem efeito. Set pelo scorer quando aesthetic_score >=
   *  threshold + tipo de execução é identificável. */
  aesthetic_style?: KillAestheticStyle;
  /** Sprint #6.5 (06/05) — POV vítima cut. Top 1-2 kills do reel ganham
   *  true. Capture pipeline emite spec_player switch durante janela
   *  [-0.5s, +0.3s]. Editor add overlay "POV VÍTIMA" durante a janela
   *  pra signalizar que é editorial. */
  pov_eligible?: boolean;
  victim_steamid?: string;
  victim_name?: string;
  kill_tick?: number;
};

export type Highlight = {
  rank: number;
  round_num: number;
  label: string;
  score: number;
  start: number;
  end: number;
  kills: Kill[];
  // clip_url — legado, usado quando o pipeline de screen capture (Round 3)
  // estava produzindo MP4 público por highlight. Mantido por compat.
  clip_url?: string | null;
  // gameplayVideoSrc — novo, vem do hlae_runner.py no PC do user.
  // Path local (file://) ou URL — Remotion <OffthreadVideo> resolve os dois.
  // Cada highlight recebe seu próprio .mov ProRes 4444 1920×1080 @ 300fps,
  // começando no frame 0 do highlight (sem offset).
  // Quando definido, sobrepõe placeholder e clip_url.
  gameplayVideoSrc?: string | null;
  // Round 4c Fase 1.28 — demo time (segundos) do PRIMEIRO frame do .mov
  // gameplay (= cluster_window[0].start_tick / tickrate). Necessário pra
  // alinhar killfeed/timeline corretamente: sem isso, killTimeInSceneSec
  // assumia gameplay começa em highlight.start + frontSkip, mas cluster
  // pode começar MUCH LATER (PAD_PRE 7s do FIRST kill). Quando ausente
  // (highlights legados ou placeholder), editor fallback pro behavior
  // antigo (highlight.start + frontSkip).
  gameplayStartSec?: number;
  // Round 4c Fase 1.33 — duração REAL do .mov gameplay pós-concat (probed
  // via ffprobe pelo client). Pra clusters que geram múltiplas windows
  // (ex: R14 W3 kills + W4 plant separados por gap > MERGE_GAP), a soma
  // dos .movs é MENOR que (highlight.end - gameplayStartSec) — gap entre
  // windows NÃO foi capturado. Sem esse cap, editor calc available
  // baseado em source-time → roda mov até acabar, depois HOLD LAST FRAME
  // por ~12s. effectiveSceneEndSec usa esse valor (quando disponível)
  // pra cap scene_end no mov real, prevenindo freeze residual.
  // Quando ausente (single take, sem concat OU highlight legado), editor
  // fallback pro behavior anterior (source-time-based).
  actualMovDurationSec?: number;
  // Round 4c Fase 1.25 — bomb action timestamp (segundos relativos ao demo
  // start, mesma base de Kill.time/highlight.start). Permite scene_end
  // dinâmico (effectiveSceneEndSec em theme.ts) usar max(kill.time,
  // bomb_action_timestamp) + REACTION_PAD pra cobrir highlights cuja
  // closing event é o plant/defuse (não kill). Mathieu reportou
  // múltiplas vezes "plant não aparece" — Fase 1.22 (kill-aware end)
  // cortava cena antes do bomb event quando plant ocorria após última kill.
  bomb_action_timestamp?: number;
  bomb_action?: "defuse" | "plant_won";
  // Sprint #6.2.1 (05/05) — plant tick INDEPENDENTE de quem plantou.
  // Editor usa pra bomb timer red bar funcionar em defuse rounds (onde
  // bomb_action_timestamp = defuse tick, não plant). Null se round
  // sem plant ou highlight legacy (pré-Sprint #6.2.1).
  bomb_planted_timestamp?: number;
  // Round 4c Fase 1.27 — alive timeline pra counter ao vivo. Inclui TODAS
  // deaths do round (não só user kills da Fase 1.23). Editor renderiza
  // counter navegando essa timeline em tempo real (sceneTime → encontra
  // event mais recente → mostra alive_ct/alive_t). Empty pra highlights
  // legados (pré-Fase 1.27) → editor fallback pro behavior da Fase 1.23
  // (kill-only updates).
  alive_timeline?: AliveEvent[];
};

export type AliveEvent = {
  time: number;     // tick em segundos (mesma base de highlight.start/end)
  alive_ct: number; // CT alive count APÓS essa morte
  alive_t: number;  // T alive count APÓS essa morte
};

export type MatchStats = {
  kd: string;
  hs: string;
  adr: string;
  rating: string;
};

export type Match = {
  id: string;
  map: string;
  date: string;
  score: string;
  side: string;
  status: string;
  stats: MatchStats;
  highlights: Highlight[];
};

// Props passadas pro Remotion via --props
export type ReelProps = {
  match: Match;
  selectedRanks: number[]; // quais highlights entram no vídeo
  mood: Mood;
  playerName: string;
  // Orientação do vídeo de saída. Default vertical (formato story/reel).
  // horizontal usa 16:9 (1920x1080) — ideal pra YouTube/Twitch.
  orientation?: Orientation;
  // Round 4c Fase 1.17 — toggle de música de fundo controlado pelo usuário
  // no match-page (UI). Game audio (tiros/passos/voice) sempre presente,
  // só a trilha mood que pode ser muted. Default true. Quando false, o
  // <Audio> da trilha não é renderizado — só o áudio do <OffthreadVideo>.
  musicEnabled?: boolean;
  // Round 4c Fase 1.27 — toggle scoreboard top-left (CT/T alive count +
  // HP). Default true. Quando false, badge top-left mostra só "{N} KILLS"
  // (fallback Fase 1.21 estático). User opt-out pra estilo "puro POV
  // sem HUD overlays" via UI toggle.
  scoreboardEnabled?: boolean;
  // Sprint #6.1 (05/05) — Kill flash effects toggle. Quando true, dispara
  // flash branco + leve scale pulse no momento de cada kill (~0.3s),
  // valoriza visualmente o impacto. Default false (off — opt-in pelo user).
  killFlashEnabled?: boolean;
  // Sprint #6.2 (05/05) — Bomb timer red bar topo do vídeo. Default false.
  // Aparece só durante highlights com plant ativo (40s timer decrescendo
  // do plant_tick até explosion). Igual broadcast Major.
  bombTimerEnabled?: boolean;
  // Sprint #6.4 (05/05) — variant da track musical do mood. 0 = primary
  // (default). Permite múltiplas trilhas por mood (acao-1, acao-2, etc).
  // theme.MOODS[mood].tracks lista as opções; resolveMoodTrack(mood, idx)
  // resolve o file. Ignored se musicEnabled=false.
  trackVariantIndex?: number;
};

export type CardProps = {
  match: Match;
  playerName: string;
  mood: Mood;
};
