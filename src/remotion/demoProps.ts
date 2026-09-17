import type { FoodTalkProps } from "../shared/schema";
import { estimateDurationSeconds } from "./estimate";

/** Props per defecte per veure la composició a Remotion Studio sense generar res. */
const script: FoodTalkProps["script"] = {
  title: "Demo",
  hook: "El tomàquet ha dit prou",
  scene: "Nevera de nit",
  characters: [
    { id: "tomaquet", name: "Tomàquet", kind: "tomato", color: "#e53935", personality: "Dramàtic", voice: "energetic_male", accessory: "none" },
    { id: "alvocat", name: "Alvocat", kind: "avocado", color: "#7cb342", personality: "Cínic", voice: "sassy_female", accessory: "sunglasses" },
  ],
  lines: [
    { speaker: "tomaquet", text: "Cada dia el mateix: amanida, amanida, amanida. Jo tinc somnis, saps?", emotion: "angry", action: "shake" },
    { speaker: "alvocat", text: "Somnis? Jo vaig ser tendència tres anys seguits. Ara em posen a les torrades i ningú fa fotos.", emotion: "smug", action: "lean_in" },
    { speaker: "tomaquet", text: "Saps què? Anem-nos-en al gaspatxo. Allà ningú demana res.", emotion: "happy", action: "jump" },
    { speaker: "alvocat", text: "Als del guacamole els diran que vam morir com herois.", emotion: "smug", action: "point" },
  ],
  punchline_index: 3,
  cta: "Segueix-nos per més drames de nevera",
  caption: "Demo",
  hashtags: ["demo"],
  image_role: "hidden",
};

export const demoProps: FoodTalkProps = {
  script,
  lines: script.lines.map((l) => ({ ...l, audioUrl: null, durationSeconds: estimateDurationSeconds(l.text) })),
  imageUrl: null,
  platform: "reel",
  brandHandle: "@elmeunegoci",
  language: "ca",
  playbackRate: 1,
  musicUrl: null,
};
