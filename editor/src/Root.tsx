import { Composition } from "remotion";
import {
  HighlightsReel,
  calcReelDurationFromHighlights,
} from "./compositions/reel/HighlightsReel";
import { MOCK_REEL_PROPS } from "./mock";
import { FPS, getDimensions } from "./theme";
import { ReelProps } from "./types";

// Helper: dado um ReelProps, devolve só os highlights selecionados.
// Usado pra computar duração real (cada highlight respeita h.end - h.start).
const selectedHighlights = (props: ReelProps) =>
  props.match.highlights.filter((h) => props.selectedRanks.includes(h.rank));

// Dimensões iniciais (defaultProps = vertical, mas calculateMetadata troca
// em runtime conforme props.orientation).
const DEFAULT_DIMS = getDimensions("vertical");

// v0.7.0 (05/05) — Reel-only cleanup. Compositions Recap + StoryCard
// removidas do Root. Files em compositions/recap/ e compositions/card/
// mantidas como dead code histórico (low priority cleanup); podem ser
// deletadas em sprint dedicada. Backend rejeita format=card e format=recap
// com 422 desde v0.7.0.
export const Root: React.FC = () => {
  return (
    <>
      {/*
        HighlightsReel — Top N highlights, duração = soma das durações reais
        (h.end - h.start clampado em REEL_HIGHLIGHT_BOUNDS) + intro + outro.
        Suporta orientação vertical (1080x1920, default) ou horizontal
        (1920x1080) via props.orientation — resolvido em calculateMetadata.
      */}
      <Composition
        id="HighlightsReel"
        component={HighlightsReel}
        defaultProps={MOCK_REEL_PROPS}
        durationInFrames={calcReelDurationFromHighlights(
          selectedHighlights(MOCK_REEL_PROPS)
        )}
        fps={FPS}
        width={DEFAULT_DIMS.width}
        height={DEFAULT_DIMS.height}
        calculateMetadata={({ props }) => {
          const dims = getDimensions(props.orientation ?? "vertical");
          return {
            durationInFrames: calcReelDurationFromHighlights(
              selectedHighlights(props)
            ),
            width: dims.width,
            height: dims.height,
          };
        }}
      />
    </>
  );
};
