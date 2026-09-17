import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { WIDTH } from "../../shared/schema";
import { FONT_TEXT } from "../layout";

export const Bubble: React.FC<{
  text: string;
  name: string;
  color: string;
  /** punt on apunta la cua (cap del personatge) */
  anchorX: number;
  anchorY: number;
  durationInFrames: number;
  isPunchline: boolean;
}> = ({ text, name, color, anchorX, anchorY, durationInFrames, isPunchline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  const exit = interpolate(frame, [durationInFrames - 4, durationInFrames + 4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const width = 720;
  const fontSize = text.length > 110 ? 38 : text.length > 70 ? 42 : 48;
  const left = Math.max(30, Math.min(WIDTH - width - 30, anchorX - width / 2));
  const tailX = Math.max(60, Math.min(width - 60, anchorX - left));
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: anchorY,
        width,
        transform: `translateY(-100%) scale(${0.7 + enter * 0.3})`,
        transformOrigin: `${tailX}px 100%`,
        opacity: Math.min(enter, exit),
      }}
    >
      <div
        style={{
          position: "relative",
          background: isPunchline ? "#fff4b3" : "#ffffff",
          borderRadius: 34,
          padding: "26px 34px 30px",
          border: `7px solid ${isPunchline ? "#1a1a1a" : color}`,
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
          fontFamily: FONT_TEXT,
          color: "#1a1a1a",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            left: 28,
            background: color,
            color: "#fff",
            fontFamily: FONT_TEXT,
            fontWeight: 900,
            fontSize: 28,
            padding: "6px 18px",
            borderRadius: 999,
            border: "4px solid #1a1a1a",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize, fontWeight: 900, lineHeight: 1.18, marginTop: 6 }}>{text}</div>
        {/* cua de la bafarada */}
        <svg
          width={60}
          height={42}
          viewBox="0 0 60 42"
          style={{ position: "absolute", left: tailX - 30, bottom: -44 }}
        >
          <path d="M6 0 L 54 0 L 30 40 Z" fill={isPunchline ? "#fff4b3" : "#ffffff"} />
          <path d="M6 0 L 30 40 L 54 0" fill="none" stroke={isPunchline ? "#1a1a1a" : color} strokeWidth={7} strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};
