import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { Highlight, ReelProps } from "../../types";
import {
  FPS,
  HIGHLIGHT_VIDEO_SKIP_SEC,
  HIGHLIGHT_VIDEO_TAIL_SKIP_SEC,
  MOODS,
  MUSIC_ENABLED,
  REEL_HIGHLIGHT_BOUNDS,
  clampHighlightSec,
  effectiveSkipSec,
  effectiveTailSkipSec,
  effectiveSceneEndSec,
  refSourceDurSec,
  s2f,
} from "../../theme";
import { Intro } from "./scenes/Intro";
import { HighlightScene } from "./scenes/HighlightScene";
import { Outro } from "./scenes/Outro";

// Durações fixas (em segundos) — só intro e outro são fixas.
// A duração de cada highlight vem do dado real (h.end - h.start),
// com clamp em REEL_HIGHLIGHT_BOUNDS pra evitar flash ou tédio.
//
// Round 4c Fase 1.12 → 1.19 evolução:
// - INTRO 2s (Fase 0) → 1.2s (Fase 1.12, Mathieu pediu rápido) — mantido
// - OUTRO 2.5s (Fase 0) → 1.5s (Fase 1.12) → 3.0s (Fase 1.19, Mathieu:
//   "título e stats no final não ficam tempo suficiente para ler"). 1.5s
//   era curto demais pra ler 4 stats novos (K/D + HS% + ADR). 3.0s dá
//   ~1.5s pra cada par de stats antes do fade. Trade aceito vs reel
//   total ficar 1.5s mais longo.
export const INTRO_SEC = 1.2;
export const OUTRO_SEC = 3.0;

// HIGHLIGHT_VIDEO_SKIP_SEC vive em theme.ts (canonical) pra evitar circular
// import HighlightScene → HighlightsReel.

// Round 4c Fase 1.22 — duração efetiva = sceneEndSec - frontSkip.
// sceneEndSec é KILL-AWARE: termina em last_kill+1s reaction quando temos
// timing das kills, fallback pra TAIL fixo. Resolve "1s freeze antes da
// transição" reportado pelo Mathieu pós-Fase 1.21 — TAIL_SKIP fixo cortava
// do FIM do source, não do fim da AÇÃO. Quando última kill era cedo no
// cluster, sobrava 1-3s standing still antes do TAIL cortar.
// Helper effectiveSceneEndSec vive em theme.ts (canonical) — DEVE bater
// com HighlightScene.availableVideoSec senão freeze edge.
const highlightDurationSec = (h: Highlight) => {
  // Round 4c Fase 1.28 — sourceDur baseado em mov-aware refStart (não
  // round_start). Garante consistency com effectiveSceneEndSec +
  // HighlightScene.availableVideoSec.
  const sourceDur = refSourceDurSec(h);
  const front = effectiveSkipSec(sourceDur);
  const sceneEnd = effectiveSceneEndSec(h);
  const rawSec = sceneEnd - front;
  return clampHighlightSec(rawSec, REEL_HIGHLIGHT_BOUNDS);
};

export const calcReelDurationFromHighlights = (highlights: Highlight[]) => {
  const sumSec = highlights.reduce((acc, h) => acc + highlightDurationSec(h), 0);
  return s2f(INTRO_SEC + sumSec + OUTRO_SEC);
};

// Helper de back-compat: aceita só count quando não temos os highlights ainda
// (ex: Studio preview). Usa duração média do clamp pra estimativa razoável.
const AVG_HIGHLIGHT_SEC =
  (REEL_HIGHLIGHT_BOUNDS.min + REEL_HIGHLIGHT_BOUNDS.max) / 2;
export const calcReelDuration = (nHighlights: number) =>
  s2f(INTRO_SEC + nHighlights * AVG_HIGHLIGHT_SEC + OUTRO_SEC);

export const HighlightsReel: React.FC<ReelProps> = ({
  match,
  selectedRanks,
  mood,
  playerName,
  musicEnabled,
  scoreboardEnabled,
}) => {
  const moodDef = MOODS[mood];

  // Round 4c Fase 1.17 — música tocada quando user opt-in via UI toggle no
  // match-page (default true). MUSIC_ENABLED é override GLOBAL pra debug:
  // se setado false em theme.ts, força mute mesmo se props pedir música.
  // Resolução: precisa BOTH o global ON E o user toggle não-explícito-false.
  // (musicEnabled === undefined fallback pra true pra compat com Studio
  // preview que não passa props customizados.)
  const playMusic = MUSIC_ENABLED && musicEnabled !== false;

  const selected = match.highlights
    .filter((h) => selectedRanks.includes(h.rank))
    .sort((a, b) => a.rank - b.rank);

  const introF = s2f(INTRO_SEC);
  const outroF = s2f(OUTRO_SEC);

  // Computa from/duration acumulando — cada highlight ganha o tamanho real.
  let cursor = introF;
  const highlightSequences = selected.map((h, i) => {
    const dur = s2f(highlightDurationSec(h));
    const node = (
      <Sequence
        key={h.rank}
        from={cursor}
        durationInFrames={dur}
      >
        <HighlightScene
          highlight={h}
          mood={mood}
          index={i}
          showScoreboard={scoreboardEnabled !== false}
        />
      </Sequence>
    );
    cursor += dur;
    return node;
  });

  return (
    <AbsoluteFill>
      {playMusic && (
        <Audio
          src={staticFile(moodDef.file)}
          // Round 4c Fase 1.19 (Mathieu: "música tá muito alta vs som do
          // jogo"). Era 0.65 → 0.35. Game audio segue 0.85 (não baixa).
          // Mix novo: música tá presente como atmosfera, game audio
          // (tiros/passos/voz) domina foreground — relação ~2.4:1 favor
          // game (vs ~1.3:1 anterior). Spec produto: game audio é
          // protagonista, música é wallpaper.
          volume={0.35}
          startFrom={0}
          // Fase 1.18 — `loop` cobre reel longo (MP3 trilhas ~60-90s vs
          // reel 100s+). Sem loop, música cortava meio do vídeo.
          loop
        />
      )}

      <Sequence from={0} durationInFrames={introF}>
        <Intro match={match} playerName={playerName} mood={mood} />
      </Sequence>

      {highlightSequences}

      <Sequence from={cursor} durationInFrames={outroF}>
        <Outro match={match} playerName={playerName} mood={mood} />
      </Sequence>
    </AbsoluteFill>
  );
};
