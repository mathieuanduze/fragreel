import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { ReelProps } from "../../types";
import { FPS, MOODS, MUSIC_ENABLED, s2f } from "../../theme";
import { Intro } from "./scenes/Intro";
import { HighlightScene } from "./scenes/HighlightScene";
import { Outro } from "./scenes/Outro";

// Durações fixas (em segundos)
export const INTRO_SEC = 2;
export const HIGHLIGHT_SEC = 4;
export const OUTRO_SEC = 2.5;

export const calcReelDuration = (nHighlights: number) =>
  s2f(INTRO_SEC + nHighlights * HIGHLIGHT_SEC + OUTRO_SEC);

export const HighlightsReel: React.FC<ReelProps> = ({
  match,
  selectedRanks,
  mood,
  playerName,
}) => {
  const moodDef = MOODS[mood];

  // Ordena os selecionados pelo rank
  const selected = match.highlights
    .filter((h) => selectedRanks.includes(h.rank))
    .sort((a, b) => a.rank - b.rank);

  const introFrames = s2f(INTRO_SEC);
  const highlightFrames = s2f(HIGHLIGHT_SEC);
  const outroFrames = s2f(OUTRO_SEC);

  return (
    <AbsoluteFill>
      {/* Música de fundo — só toca quando os MP3s estiverem em public/music/ */}
      {MUSIC_ENABLED && (
        <Audio
          src={staticFile(moodDef.file)}
          volume={0.65}
          startFrom={0}
        />
      )}

      <Sequence from={0} durationInFrames={introFrames}>
        <Intro match={match} playerName={playerName} mood={mood} />
      </Sequence>

      {selected.map((h, i) => (
        <Sequence
          key={h.rank}
          from={introFrames + i * highlightFrames}
          durationInFrames={highlightFrames}
        >
          <HighlightScene highlight={h} mood={mood} index={i} />
        </Sequence>
      ))}

      <Sequence
        from={introFrames + selected.length * highlightFrames}
        durationInFrames={outroFrames}
      >
        <Outro match={match} playerName={playerName} mood={mood} />
      </Sequence>
    </AbsoluteFill>
  );
};
