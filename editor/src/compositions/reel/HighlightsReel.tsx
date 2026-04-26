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
  MOODS,
  MUSIC_ENABLED,
  REEL_HIGHLIGHT_BOUNDS,
  clampHighlightSec,
  s2f,
} from "../../theme";
import { Intro } from "./scenes/Intro";
import { HighlightScene } from "./scenes/HighlightScene";
import { Outro } from "./scenes/Outro";

// Durações fixas (em segundos) — só intro e outro são fixas.
// A duração de cada highlight vem do dado real (h.end - h.start),
// com clamp em REEL_HIGHLIGHT_BOUNDS pra evitar flash ou tédio.
//
// Round 4c Fase 1.12 (Mathieu reportou "transições MUITO lentas, vídeo
// parado por segundos entre rounds"). INTRO 2 → 1.2s e OUTRO 2.5 → 1.5s
// cortam 1.8s de "branding dead time" sem comprometer leitura de
// player_name/mapa/score (springs no Intro estabilizam em ~25 frames =
// 0.83s; resto era margem demais).
export const INTRO_SEC = 1.2;
export const OUTRO_SEC = 1.5;

// HIGHLIGHT_VIDEO_SKIP_SEC vive em theme.ts (canonical) pra evitar circular
// import HighlightScene → HighlightsReel.

// Fase 1.12 — duração efetiva = source duration - SKIP. Como pulamos 2s do
// início via OffthreadVideo startFrom, a scene precisa ficar 2s mais curta
// pra não rodar pro fim do .mov e dar freeze/black no end. Mantém
// playbackRate ≈ 1.0 (real-time spec) e clamp REEL_BOUNDS aplica depois.
const highlightDurationSec = (h: Highlight) => {
  const rawSec = h.end - h.start - HIGHLIGHT_VIDEO_SKIP_SEC;
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
        <HighlightScene highlight={h} mood={mood} index={i} />
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
          volume={0.65}
          startFrom={0}
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
