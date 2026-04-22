import { Composition } from "remotion";
import {
  HighlightsReel,
  calcReelDurationFromHighlights,
} from "./compositions/reel/HighlightsReel";
import {
  Recap,
  calcRecapDurationFromHighlights,
} from "./compositions/recap/Recap";
import { StoryCard } from "./compositions/card/StoryCard";
import { MOCK_REEL_PROPS, MOCK_CARD_PROPS } from "./mock";
import { FPS, getDimensions } from "./theme";
import { ReelProps } from "./types";

// Helper: dado um ReelProps, devolve só os highlights selecionados.
// Usado pra computar duração real (cada highlight respeita h.end - h.start).
const selectedHighlights = (props: ReelProps) =>
  props.match.highlights.filter((h) => props.selectedRanks.includes(h.rank));

// Dimensões iniciais (defaultProps = vertical, mas calculateMetadata troca
// em runtime conforme props.orientation).
const DEFAULT_DIMS = getDimensions("vertical");

export const Root: React.FC = () => {
  return (
    <>
      {/*
        HighlightsReel — Top N highlights, duração = soma das durações reais
        (h.end - h.start clampado em [3, 7]s) + intro + outro.
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

      {/*
        Recap — retrospectivo da partida (~50-90s). Cada highlight respeita
        a duração real clampada em [4, 10]s — bounds maiores que o reel.
      */}
      <Composition
        id="Recap"
        component={Recap}
        defaultProps={MOCK_REEL_PROPS}
        durationInFrames={calcRecapDurationFromHighlights(
          selectedHighlights(MOCK_REEL_PROPS)
        )}
        fps={FPS}
        width={DEFAULT_DIMS.width}
        height={DEFAULT_DIMS.height}
        calculateMetadata={({ props }) => {
          const dims = getDimensions(props.orientation ?? "vertical");
          return {
            durationInFrames: calcRecapDurationFromHighlights(
              selectedHighlights(props)
            ),
            width: dims.width,
            height: dims.height,
          };
        }}
      />

      {/*
        StoryCard — 1 frame exportado como PNG. Sempre 9:16 (story de Instagram).
        Não respeita orientation — formato é semântico do produto.
      */}
      <Composition
        id="StoryCard"
        component={StoryCard}
        defaultProps={MOCK_CARD_PROPS}
        durationInFrames={60}
        fps={FPS}
        width={DEFAULT_DIMS.width}
        height={DEFAULT_DIMS.height}
      />
    </>
  );
};
