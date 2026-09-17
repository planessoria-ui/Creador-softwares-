import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_DISPLAY, FONT_TEXT } from "../layout";

const LABELS = {
  ca: { follow: "Segueix", share: "Comparteix-ho amb qui ho necessita" },
  es: { follow: "Sigue", share: "Compártelo con quien lo necesite" },
  en: { follow: "Follow", share: "Share it with someone who needs it" },
};

export const EndCard: React.FC<{
  cta: string;
  brandHandle: string;
  imageUrl: string | null;
  color: string;
  language: "ca" | "es" | "en";
  safeTop: number;
  safeBottom: number;
}> = ({ cta, brandHandle, imageUrl, color, language, safeTop, safeBottom }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const pop = spring({ frame: frame - 6, fps, config: { damping: 10, stiffness: 150 } });
  const pop2 = spring({ frame: frame - 16, fps, config: { damping: 12, stiffness: 150 } });
  const labels = LABELS[language];
  return (
    <AbsoluteFill style={{ background: `rgba(12,12,24,${0.82 * fade})`, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: safeTop,
          bottom: safeBottom,
          left: 60,
          right: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          textAlign: "center",
        }}
      >
        {imageUrl && (
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: "50%",
              overflow: "hidden",
              border: `12px solid ${color}`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              transform: `scale(${pop})`,
            }}
          >
            <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 74,
            lineHeight: 1.08,
            color: "#fff",
            transform: `scale(${pop2})`,
            textShadow: "0 8px 30px rgba(0,0,0,0.6)",
          }}
        >
          {cta}
        </div>
        {brandHandle && (
          <div
            style={{
              fontFamily: FONT_TEXT,
              fontWeight: 900,
              fontSize: 44,
              color: "#1a1a1a",
              background: "#ffe14d",
              padding: "14px 34px",
              borderRadius: 999,
              border: "5px solid #1a1a1a",
              transform: `scale(${pop2})`,
            }}
          >
            {labels.follow} {brandHandle.startsWith("@") ? brandHandle : `@${brandHandle}`}
          </div>
        )}
        <div style={{ fontFamily: FONT_TEXT, fontWeight: 700, fontSize: 30, color: "rgba(255,255,255,0.75)", opacity: pop2 }}>
          {labels.share}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.001 }} />
    </AbsoluteFill>
  );
};
