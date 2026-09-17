import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_DISPLAY } from "../layout";

export const Hook: React.FC<{ text: string; top: number; centerX: number; width: number; outFrame: number }> = ({
  text,
  top,
  centerX,
  width,
  outFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 9, stiffness: 180, mass: 0.7 } });
  const exit = interpolate(frame, [outFrame - 8, outFrame + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wobble = Math.sin(frame / 6) * 1.2;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: centerX - width / 2,
        width,
        display: "flex",
        justifyContent: "center",
        opacity: exit,
        transform: `scale(${0.6 + enter * 0.4}) rotate(${-3 + wobble}deg)`,
        transformOrigin: "50% 50%",
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: text.length > 28 ? 66 : 80,
          lineHeight: 1.05,
          color: "#1a1a1a",
          background: "#ffe14d",
          padding: "18px 36px",
          borderRadius: 22,
          textAlign: "center",
          boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
          border: "6px solid #1a1a1a",
          maxWidth: width,
        }}
      >
        {text}
      </div>
    </div>
  );
};
