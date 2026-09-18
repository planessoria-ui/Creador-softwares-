import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_TEXT } from "../layout";

/** Subtítol gran a la part baixa, estil TikTok, amb el nom de qui parla. */
export const Caption: React.FC<{
  text: string;
  name: string;
  color: string;
  bottom: number;
  width: number;
  centerX: number;
  durationInFrames: number;
  isPunchline: boolean;
}> = ({ text, name, color, bottom, width, centerX, durationInFrames, isPunchline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const exit = interpolate(frame, [durationInFrames - 4, durationInFrames + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fontSize = text.length > 110 ? 44 : text.length > 70 ? 50 : 58;
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left: centerX - width / 2,
        width,
        textAlign: "center",
        opacity: Math.min(enter, exit),
        transform: `translateY(${(1 - enter) * 30}px)`,
        fontFamily: FONT_TEXT,
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: color,
          color: "#fff",
          fontWeight: 900,
          fontSize: 28,
          padding: "6px 20px",
          borderRadius: 999,
          border: "4px solid #1a1a1a",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize,
          fontWeight: 900,
          lineHeight: 1.15,
          color: isPunchline ? "#ffe14d" : "#fff",
          textShadow: "0 3px 0 #1a1a1a, 0 -3px 0 #1a1a1a, 3px 0 0 #1a1a1a, -3px 0 0 #1a1a1a, 0 10px 30px rgba(0,0,0,0.7)",
          padding: "0 10px",
        }}
      >
        {text}
      </div>
    </div>
  );
};
