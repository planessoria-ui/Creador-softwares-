import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { FPS, HEIGHT, WIDTH, type FoodTalkProps } from "../shared/schema";
import { buildTimeline } from "../shared/timeline";
import { FoodTalk } from "./FoodTalk";
import { demoProps } from "./demoProps";
import { Gallery } from "./Gallery";

/**
 * Calcula la durada real del vídeo: mesura els àudios que encara no tenen durada,
 * aplica el límit de 60 s i retorna les props definitives.
 */
export const calculateFoodTalkMetadata: CalculateMetadataFunction<FoodTalkProps> = async ({ props }) => {
  const lines = await Promise.all(
    props.lines.map(async (line) => {
      if (line.audioUrl && !(line.durationSeconds > 0)) {
        const d = await getAudioDurationInSeconds(line.audioUrl);
        return { ...line, durationSeconds: d };
      }
      return line;
    })
  );
  const { timeline, lines: keptLines, script } = buildTimeline(props.script, lines);
  return {
    durationInFrames: timeline.totalFrames,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    props: { ...props, lines: keptLines, script, playbackRate: timeline.playbackRate },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FoodTalk"
        component={FoodTalk}
        durationInFrames={30 * 40}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={demoProps}
        calculateMetadata={calculateFoodTalkMetadata}
      />
      <Composition id="Gallery" component={Gallery} durationInFrames={FPS * 8} fps={FPS} width={WIDTH} height={HEIGHT} />
    </>
  );
};
