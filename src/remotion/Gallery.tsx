import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { EMOTIONS, FOOD_KINDS } from "../shared/schema";
import { FoodCharacter } from "./components/Character";
import { FONT_TEXT } from "./layout";

const COLORS: Record<string, string> = {
  apple: "#e53935", banana: "#fdd835", tomato: "#e53935", carrot: "#fb8c00", broccoli: "#43a047",
  avocado: "#7cb342", lemon: "#fdd835", strawberry: "#e53935", pepper: "#43a047", orange: "#fb8c00",
  pizza: "#e53935", egg: "#ffb300", bread: "#c68642", cheese: "#fdd835", watermelon: "#ef5350",
  eggplant: "#6a1b9a", potato: "#c9a06c", mushroom: "#d84315", croissant: "#e0a341", donut: "#f48fb1",
  grape: "#7b1fa2", pear: "#9ccc65", onion: "#ce93d8", garlic: "#f5f5f5", corn: "#fdd835",
  peach: "#ffab91", cherry: "#c62828", pineapple: "#fbc02d", burger: "#795548", taco: "#c62828",
  sushi: "#ef5350", cupcake: "#f48fb1", icecream: "#f8bbd0", coffee: "#6d4c41",
};

/** Galeria de tots els personatges: útil per revisar els dibuixos a Remotion Studio. */
export const Gallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = 5;
  const cell = 1080 / cols;
  const emotion = EMOTIONS[Math.floor(frame / fps) % EMOTIONS.length];
  const mouth = (Math.sin(frame / 3) + 1) / 2;
  return (
    <AbsoluteFill style={{ background: "#1b1b2f", fontFamily: FONT_TEXT }}>
      {FOOD_KINDS.map((kind, i) => (
        <div key={kind} style={{ position: "absolute", left: (i % cols) * cell, top: 40 + Math.floor(i / cols) * 250, width: cell, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <FoodCharacter
              character={{ id: kind, name: kind, kind, color: COLORS[kind] ?? "#ff7043", personality: "", voice: "warm_male", accessory: i % 4 === 0 ? "glasses" : i % 4 === 1 ? "hat" : i % 4 === 2 ? "none" : "bowtie" }}
              mouth={mouth}
              emotion={emotion}
              active={i % 2 === 0}
              lineFrame={null}
              action="none"
              size={cell * 0.9}
              facing={1}
              seed={kind}
            />
          </div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>{kind}</div>
        </div>
      ))}
      <div style={{ position: "absolute", bottom: 30, width: "100%", textAlign: "center", color: "#ffe14d", fontSize: 30, fontWeight: 900 }}>
        emoció: {emotion}
      </div>
    </AbsoluteFill>
  );
};
