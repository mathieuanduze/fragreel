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
  RECAP_HIGHLIGHT_BOUNDS,
  clampHighlightSec,
  s2f,
} from "../../theme";
import { RecapIntro } from "./scenes/RecapIntro";
import { RoundsTimeline } from "./scenes/RoundsTimeline";
import { HighlightScene } from "../reel/scenes/HighlightScene";
import { Outro } from "../reel/scenes/Outro";

// Recap = retrospectivo da partida inteira (mais longo que reel).
// Cada highlight respeita a duração real (h.end - h.start) clampeada
// em RECAP_HIGHLIGHT_BOUNDS — bounds maiores que o reel pra dar
// "espaço" às jogadas mais longas.
export const RECAP_INTRO_SEC = 4;
export const RECAP_TIMELINE_SEC = 12;
export const RECAP_OUTRO_SEC = 3;

const recapHighlightDurationSec = (h: Highlight) =>
  clampHighlightSec(h.end - h.start, RECAP_HIGHLIGHT_BOUNDS);

export const calcRecapDurationFromHighlights = (highlights: Highlight[]) => {
  const sumSec = highlights.reduce(
    (acc, h) => acc + recapHighlightDurationSec(h),
    0
  );
  return s2f(
    RECAP_INTRO_SEC + RECAP_TIMELINE_SEC + sumSec + RECAP_OUTRO_SEC
  );
};

const AVG_RECAP_HIGHLIGHT_SEC =
  (RECAP_HIGHLIGHT_BOUNDS.min + RECAP_HIGHLIGHT_BOUNDS.max) / 2;
export const calcRecapDuration = (nHighlights: number) =>
  s2f(
    RECAP_INTRO_SEC +
      RECAP_TIMELINE_SEC +
      nHighlights * AVG_RECAP_HIGHLIGHT_SEC +
      RECAP_OUTRO_SEC
  );

export const Recap: React.FC<ReelProps> = ({
  match,
  selectedRanks,
  mood,
  playerName,
}) => {
  const moodDef = MOODS[mood];

  const selected = match.highlights
    .filter((h) => selectedRanks.includes(h.rank))
    .sort((a, b) => a.rank - b.rank);

  const introF = s2f(RECAP_INTRO_SEC);
  const timelineF = s2f(RECAP_TIMELINE_SEC);
  const outroF = s2f(RECAP_OUTRO_SEC);

  let cursor = introF + timelineF;
  const highlightSequences = selected.map((h, i) => {
    const dur = s2f(recapHighlightDurationSec(h));
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
        <Audio src={staticFile(moodDef.file)} volume={0.6} startFrom={0} />
      )}

      <Sequence from={0} durationInFrames={introF}>
        <RecapIntro match={match} playerName={playerName} mood={mood} />
      </Sequence>

      <Sequence from={introF} durationInFrames={timelineF}>
        <RoundsTimeline match={match} mood={mood} />
      </Sequence>

      {highlightSequences}

      <Sequence from={cursor} durationInFrames={outroF}>
        <Outro match={match} playerName={playerName} mood={mood} />
      </Sequence>
    </AbsoluteFill>
  );
};
