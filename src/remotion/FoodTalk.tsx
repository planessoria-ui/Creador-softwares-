import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import type { Character, FoodTalkProps, ImageCharacter as ImageCharacterDef } from "../shared/schema";
import { buildTimeline, type Segment } from "../shared/timeline";
import { Background } from "./components/Background";
import { Bubble } from "./components/Bubble";
import { FoodCharacter } from "./components/Character";
import { ImageCharacter } from "./components/ImageCharacter";
import { EndCard } from "./components/EndCard";
import { Hook } from "./components/Hook";
import { ImageCard } from "./components/ImageCard";
import { layoutFor } from "./layout";

/** Obertura de boca sintètica quan no hi ha àudio (0..1). */
function useSyntheticMouth(): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const v = (Math.sin(t * 17) + Math.sin(t * 11.3) + 2) / 4;
  return v > 0.35 ? v : 0;
}

/** Obertura de boca a partir de l'àudio de la línia (0..1). */
function useAudioMouth(src: string, playbackRate: number): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(src);
  if (!audioData) return 0;
  const bars = visualizeAudio({
    fps,
    frame: Math.round(frame * playbackRate),
    audioData,
    numberOfSamples: 32,
    smoothing: true,
  });
  // Les freqüències de la veu humana estan sobretot a les bandes baixes-mitjanes
  const voice = bars.slice(1, 12);
  const energy = voice.reduce((a, b) => a + b, 0) / voice.length;
  const v = interpolate(energy, [0.02, 0.28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return v < 0.08 ? 0 : v;
}

const FONT_CSS = `
@font-face { font-family: 'Fredoka'; src: url('${staticFile("fonts/Fredoka-Bold.ttf")}') format('truetype'); font-weight: 700; }
@font-face { font-family: 'Nunito'; src: url('${staticFile("fonts/Nunito-Black.ttf")}') format('truetype'); font-weight: 900; }
`;

type StageProps = {
  characters: Character[];
  segment: Segment | null;
  mouth: number;
  size: number;
  centerX: number;
  bottom: number;
  usableW: number;
  cutoutUrl: string | null;
  imageCharacter: ImageCharacterDef | null;
};

function positionsFor(n: number, centerX: number, usableW: number): number[] {
  if (n === 1) return [centerX];
  if (n === 2) return [centerX - usableW * 0.24, centerX + usableW * 0.24];
  return [centerX - usableW * 0.34, centerX, centerX + usableW * 0.34];
}

const Stage: React.FC<StageProps> = ({ characters, segment, mouth, size, centerX, bottom, usableW, cutoutUrl, imageCharacter }) => {
  const frame = useCurrentFrame();
  const xs = positionsFor(characters.length, centerX, usableW);
  let imageVariant = 0;
  return (
    <>
      {characters.map((c, i) => {
        const active = segment?.line.speaker === c.id;
        const facing: 1 | -1 = xs[i] <= centerX ? 1 : -1;
        if (c.source === "image" && cutoutUrl && imageCharacter) {
          const variant = imageVariant++;
          const height = size * 1.55;
          return (
            <div key={c.id} style={{ position: "absolute", left: xs[i], top: bottom - height, transform: "translateX(-50%)", zIndex: active ? 3 : 2 }}>
              <ImageCharacter
                character={c}
                cutoutUrl={cutoutUrl}
                geometry={imageCharacter}
                variant={variant}
                mouth={active ? mouth : 0}
                active={Boolean(active)}
                lineFrame={active ? frame - segment!.from : null}
                action={active ? segment!.line.action : "none"}
                height={height}
                facing={characters.length === 1 ? 1 : facing}
                seed={`${c.id}-${i}`}
              />
            </div>
          );
        }
        return (
          <div key={c.id} style={{ position: "absolute", left: xs[i] - size / 2, top: bottom - size, zIndex: active ? 3 : 2 }}>
            <FoodCharacter
              character={c}
              mouth={active ? mouth : 0}
              emotion={active ? segment!.line.emotion : "neutral"}
              active={Boolean(active)}
              lineFrame={active ? frame - segment!.from : null}
              action={active ? segment!.line.action : "none"}
              size={size}
              facing={characters.length === 1 ? 1 : facing}
              seed={`${c.id}-${i}`}
            />
          </div>
        );
      })}
    </>
  );
};

/** Un segment de diàleg: àudio + bafarada + boca sincronitzada. */
const LineSegment: React.FC<{
  segment: Segment;
  character: Character;
  playbackRate: number;
  anchorX: number;
  anchorY: number;
  isPunchline: boolean;
}> = ({ segment, character, playbackRate, anchorX, anchorY, isPunchline }) => {
  return (
    <>
      {segment.line.audioUrl && <Audio src={segment.line.audioUrl} playbackRate={playbackRate} />}
      <Bubble
        text={segment.line.text}
        name={character.name}
        color={character.color}
        anchorX={anchorX}
        anchorY={anchorY}
        durationInFrames={segment.durationInFrames}
        isPunchline={isPunchline}
      />
    </>
  );
};

type MouthChildren = (mouth: number) => React.ReactNode;

const AudioMouth: React.FC<{ src: string; playbackRate: number; children: MouthChildren }> = ({ src, playbackRate, children }) => {
  const mouth = useAudioMouth(src, playbackRate);
  return <>{children(mouth)}</>;
};

const SyntheticMouth: React.FC<{ children: MouthChildren }> = ({ children }) => {
  const mouth = useSyntheticMouth();
  return <>{children(mouth)}</>;
};

const MouthProbe: React.FC<{ segment: Segment; playbackRate: number; children: MouthChildren }> = ({ segment, playbackRate, children }) => {
  const frameInSegment = useCurrentFrame() - segment.from;
  // Sense àudio: boca sintètica només mentre dura la línia
  if (!segment.line.audioUrl) {
    return frameInSegment >= 0 && frameInSegment < segment.durationInFrames ? (
      <SyntheticMouth>{children}</SyntheticMouth>
    ) : (
      <>{children(0)}</>
    );
  }
  return (
    <AudioMouth src={segment.line.audioUrl} playbackRate={playbackRate}>
      {children}
    </AudioMouth>
  );
};

export const FoodTalk: React.FC<FoodTalkProps> = (props) => {
  const { script, lines, imageUrl, cutoutUrl, platform, brandHandle, language, playbackRate, musicUrl } = props;
  const frame = useCurrentFrame();
  const { timeline, script: finalScript } = buildTimeline(script, lines);
  const layout = layoutFor(platform);

  const n = finalScript.characters.length;
  const size = n === 1 ? 640 : n === 2 ? 560 : 420;
  const xs = positionsFor(n, layout.centerX, layout.usableW);
  const usesImage = Boolean(cutoutUrl && finalScript.image_character && finalScript.characters.some((c) => c.source === "image"));
  const showCard = Boolean(imageUrl) && finalScript.image_role === "product" && !usesImage;
  const stageBottom = layout.stageBottom;

  const current = timeline.segments.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? null;
  const inEndCard = frame >= timeline.endCardFrom;
  const speakerColor = finalScript.characters[0]?.color ?? "#ff7043";

  const renderStage = (mouth: number) => (
    <Stage
      characters={finalScript.characters}
      segment={current}
      mouth={mouth}
      size={size}
      centerX={layout.centerX}
      bottom={stageBottom}
      usableW={layout.usableW}
      cutoutUrl={usesImage ? cutoutUrl : null}
      imageCharacter={usesImage ? finalScript.image_character : null}
    />
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <style>{FONT_CSS}</style>
      <Background imageUrl={imageUrl} role={usesImage ? "backdrop" : finalScript.image_role} colors={finalScript.characters.map((c) => c.color)} />

      {showCard && imageUrl && (
        <ImageCard imageUrl={imageUrl} top={layout.cardTop} height={layout.cardH} centerX={layout.centerX} width={layout.usableW} />
      )}

      {musicUrl && <Audio src={/^https?:/.test(musicUrl) ? musicUrl : staticFile(musicUrl)} volume={0.12} loop />}

      {/* Escenari amb personatges; la boca ve de l'àudio del segment actiu */}
      {current ? (
        <MouthProbe key={current.index} segment={current} playbackRate={playbackRate}>
          {(mouth) => renderStage(mouth)}
        </MouthProbe>
      ) : (
        renderStage(0)
      )}

      <Sequence from={0} durationInFrames={timeline.hookFrames + 30} layout="none">
        <div style={{ position: "absolute", inset: 0, zIndex: 6 }}>
        <Hook text={finalScript.hook} top={layout.hookTop} centerX={layout.centerX} width={layout.usableW} outFrame={timeline.hookFrames + 18} />
        </div>
      </Sequence>

      {timeline.segments.map((seg) => {
        const idx = finalScript.characters.findIndex((c) => c.id === seg.line.speaker);
        const character = finalScript.characters[Math.max(0, idx)];
        const anchorX = xs[Math.max(0, idx)];
        const isImage = usesImage && character.source === "image";
        const anchorY = stageBottom - (isImage ? size * 1.55 * (finalScript.image_character?.face.y ?? 0.1) + 10 : size * 0.92);
        return (
          <Sequence key={seg.index} from={seg.from} durationInFrames={seg.durationInFrames + 8} layout="none">
            <div style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }}>
              <LineSegment
              segment={seg}
              character={character}
              playbackRate={playbackRate}
              anchorX={anchorX}
              anchorY={anchorY}
              isPunchline={seg.index === finalScript.punchline_index}
              />
            </div>
          </Sequence>
        );
      })}

      {inEndCard && (
        <Sequence from={timeline.endCardFrom} layout="none">
          <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
            <EndCard
            cta={finalScript.cta}
            brandHandle={brandHandle}
            imageUrl={imageUrl && finalScript.image_role !== "hidden" ? imageUrl : null}
            color={speakerColor}
            language={language}
            safeTop={layout.safe.top}
            safeBottom={layout.safe.bottom}
            />
          </div>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
