import { Composition } from "remotion";
import { HighlightsReel, calcReelDuration } from "./compositions/reel/HighlightsReel";
import { StoryCard } from "./compositions/card/StoryCard";
import { MOCK_REEL_PROPS, MOCK_CARD_PROPS } from "./mock";
import { FPS } from "./theme";

// 9:16 vertical — 1080x1920 é o padrão do TikTok/Reels/Shorts
const WIDTH_9_16 = 1080;
const HEIGHT_9_16 = 1920;

export const Root: React.FC = () => {
  return (
    <>
      {/*
        HighlightsReel — duração calculada dinamicamente a partir
        do número de highlights selecionados. Para o Studio preview,
        usamos o mock com 3 highlights → ~16.5s.
      */}
      <Composition
        id="HighlightsReel"
        component={HighlightsReel}
        defaultProps={MOCK_REEL_PROPS}
        durationInFrames={calcReelDuration(
          MOCK_REEL_PROPS.selectedRanks.length
        )}
        fps={FPS}
        width={WIDTH_9_16}
        height={HEIGHT_9_16}
        calculateMetadata={({ props }) => ({
          durationInFrames: calcReelDuration(props.selectedRanks.length),
        })}
      />

      {/*
        StoryCard — 1 frame exportado como PNG.
        Mantemos 60 frames pra permitir preview de pulse animation.
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
