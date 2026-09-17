import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { WIDTH } from "../../shared/schema";

export const ImageCard: React.FC<{ imageUrl: string; top: number; height: number; centerX: number; width: number }> = ({
  imageUrl,
  top,
  height,
  centerX,
  width,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 110 } });
  const drift = interpolate(frame, [0, durationInFrames], [0, 1]);
  const w = Math.min(width, WIDTH - 80);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: centerX - w / 2,
        width: w,
        height,
        borderRadius: 36,
        overflow: "hidden",
        boxShadow: "0 30px 60px rgba(0,0,0,0.45), 0 0 0 8px rgba(255,255,255,0.92)",
        transform: `rotate(${-2 + drift * 1.5}deg) scale(${0.85 + enter * 0.15})`,
        opacity: enter,
        background: "#fff",
      }}
    >
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.02 + drift * 0.08}) translate(${-drift * 12}px, ${-drift * 8}px)`,
        }}
      />
    </div>
  );
};
