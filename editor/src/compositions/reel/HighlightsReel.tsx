import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { Highlight, ReelProps } from "../../types";
import {
  FPS,
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
export const INTRO_SEC = 2;
export const OUTRO_SEC = 2.5;

const highlightDurationSec = (h: Highlight) =>
  clampHighlightSec(h.end - h.start, REEL_HIGHLIGHT_BOUNDS);

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
}) => {
  const moodDef = MOODS[mood];

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
      {MUSIC_ENABLED && (
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
