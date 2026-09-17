import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Script } from "../../shared/schema";

export const Background: React.FC<{ imageUrl: string | null; role: Script["image_role"]; colors: string[] }> = ({
  imageUrl,
  role,
  colors,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.05, 1.18]);
  const [c1 = "#ff7043", c2 = "#7cb342"] = colors;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${c1} 0%, #1b1b2f 55%, ${c2} 130%)` }}>
      {imageUrl && role !== "hidden" && (
        <Img
          src={imageUrl}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom})`,
            filter: role === "backdrop" ? "blur(3px) brightness(0.75)" : "blur(28px) brightness(0.55) saturate(1.3)",
          }}
        />
      )}
      {/* patró de punts suau per donar textura quan no hi ha imatge */}
      {(!imageUrl || role === "hidden") && (
        <AbsoluteFill
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 3px, transparent 3px)",
            backgroundSize: "64px 64px",
            backgroundPosition: `${frame * 0.4}px ${frame * 0.25}px`,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
