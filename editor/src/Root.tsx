import { Composition } from "remotion";
import {
  HighlightsReel,
  calcReelDuration,
  calcReelDurationFromHighlights,
} from "./compositions/reel/HighlightsReel";
import {
  Recap,
  calcRecapDuration,
  calcRecapDurationFromHighlights,
} from "./compositions/recap/Recap";
import { StoryCard } from "./compositions/card/StoryCard";
import { MOCK_REEL_PROPS, MOCK_CARD_PROPS } from "./mock";
import { FPS } from "./theme";
import { ReelProps } from "./types";

// 9:16 vertical — 1080x1920 é o padrão do TikTok/Reels/Shorts
const WIDTH_9_16 = 1080;
const HEIGHT_9_16 = 1920;

// Helper: dado um ReelProps, devolve só os highlights selecionados.
// Usado pra computar duração real (cada highlight respeita h.end - h.start).
const selectedHighlights = (props: ReelProps) =>
  props.match.highlights.filter((h) => props.selectedRanks.includes(h.rank));

export const Root: React.FC = () => {
  return (
    <>
      {/*
        HighlightsReel — Top N highlights, duração = soma das durações reais
        (h.end - h.start clampado em [3, 7]s) + intro + outro. Em produção,
        --props traz o match real do parser; defaultProps é só pro Studio.
      */}
      <Composition
        id="HighlightsReel"
        component={HighlightsReel}
        defaultProps={MOCK_REEL_PROPS}
        durationInFrames={calcReelDurationFromHighlights(
          selectedHighlights(MOCK_REEL_PROPS)
        )}
        fps={FPS}
        width={WIDTH_9_16}
        height={HEIGHT_9_16}
        calculateMetadata={({ props }) => ({
          durationInFrames: calcReelDurationFromHighlights(
            selectedHighlights(props)
          ),
        })}
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
        width={WIDTH_9_16}
        height={HEIGHT_9_16}
        calculateMetadata={({ props }) => ({
          durationInFrames: calcRecapDurationFromHighlights(
            selectedHighlights(props)
          ),
        })}
      />

      {/*
        StoryCard — 1 frame exportado como PNG. 60 frames pra preview de pulse.
      */}
      <Composition
        id="StoryCard"
        component={StoryCard}
        defaultProps={MOCK_CARD_PROPS}
        durationInFrames={60}
        fps={FPS}
        width={WIDTH_9_16}
        height={HEIGHT_9_16}
      />
    </>
  );
};
