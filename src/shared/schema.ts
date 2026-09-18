import { z } from "zod";

/** Tipus de menjar que sabem dibuixar. Claude n'ha de triar un per personatge. */
export const FOOD_KINDS = [
  "apple",
  "banana",
  "tomato",
  "carrot",
  "broccoli",
  "avocado",
  "lemon",
  "strawberry",
  "pepper",
  "orange",
  "pizza",
  "egg",
  "bread",
  "cheese",
  "watermelon",
  "eggplant",
  "potato",
  "mushroom",
  "croissant",
  "donut",
  "grape",
  "pear",
  "onion",
  "garlic",
  "corn",
  "peach",
  "cherry",
  "pineapple",
  "burger",
  "taco",
  "sushi",
  "cupcake",
  "icecream",
  "coffee",
] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];

/** Arquetips de veu: cada proveïdor TTS els mapeja a una veu concreta. */
export const VOICE_ARCHETYPES = [
  "deep_male",
  "warm_male",
  "energetic_male",
  "grumpy_old_male",
  "warm_female",
  "energetic_female",
  "sassy_female",
  "squeaky",
  "kid",
] as const;
export type VoiceArchetype = (typeof VOICE_ARCHETYPES)[number];

export const EMOTIONS = [
  "neutral",
  "happy",
  "angry",
  "surprised",
  "sad",
  "smug",
  "confused",
  "scared",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const CharacterSchema = z.object({
  id: z.string().describe("Identificador curt i únic, p. ex. 'tomaquet'"),
  name: z.string().describe("Nom del personatge tal com es mostra"),
  kind: z.enum(FOOD_KINDS).describe("Tipus de menjar (determina el dibuix)"),
  color: z
    .string()
    .describe("Color principal en hexadecimal (#RRGGBB), coherent amb el menjar"),
  personality: z.string().describe("Una frase amb la personalitat i el to de veu"),
  voice: z.enum(VOICE_ARCHETYPES),
  accessory: z
    .enum(["none", "glasses", "sunglasses", "hat", "bowtie", "mustache", "crown", "headphones"])
    .describe("Accessori visual opcional"),
  source: z
    .enum(["drawn", "image"])
    .describe(
      "drawn: personatge dibuixat segons 'kind'. image: és el personatge retallat de la imatge de l'usuari (el primer és l'original; els següents, variants semblants)"
    ),
});
export type Character = z.infer<typeof CharacterSchema>;

/** On és la cara i la boca del personatge dins de la imatge (coordenades 0..1 relatives a l'amplada/alçada). */
export const ImageCharacterSchema = z.object({
  description: z.string().describe("Descripció breu del personatge de la imatge (què és, estil, roba, expressió)"),
  face: z.object({
    x: z.number().min(0).max(1).describe("Vora esquerra de la cara (0..1)"),
    y: z.number().min(0).max(1).describe("Vora superior de la cara (0..1)"),
    w: z.number().min(0).max(1).describe("Amplada de la cara (0..1)"),
    h: z.number().min(0).max(1).describe("Alçada de la cara (0..1)"),
  }),
  mouth: z.object({
    x: z.number().min(0).max(1).describe("Centre horitzontal de la boca (0..1)"),
    y: z.number().min(0).max(1).describe("Centre vertical de la boca (0..1)"),
    w: z.number().min(0).max(1).describe("Amplada de la boca (0..1 de l'amplada de la imatge)"),
  }),
});
export type ImageCharacter = z.infer<typeof ImageCharacterSchema>;

export const LineSchema = z.object({
  speaker: z.string().describe("id del personatge que parla"),
  text: z.string().describe("Text que diu, tal com s'ha de pronunciar (màx. ~20 paraules)"),
  emotion: z.enum(EMOTIONS),
  action: z
    .enum(["none", "jump", "shake", "spin", "lean_in", "facepalm", "point"])
    .describe("Petita animació que acompanya la frase"),
});
export type Line = z.infer<typeof LineSchema>;

export const ScriptSchema = z.object({
  title: z.string().describe("Títol intern curt del vídeo"),
  hook: z
    .string()
    .describe("Frase-ganxo de màx. 8 paraules que apareix escrita els primers 2 segons"),
  scene: z.string().describe("On són i què passa, en una frase"),
  characters: z.array(CharacterSchema).min(1).max(3),
  lines: z.array(LineSchema).min(3).max(14),
  punchline_index: z
    .number()
    .int()
    .describe("Índex (0-based) de la línia que és el remat final"),
  cta: z.string().describe("Crida a l'acció curta per a la targeta final (màx. 8 paraules)"),
  caption: z.string().describe("Text de la descripció per publicar (2-3 frases, sense hashtags)"),
  hashtags: z.array(z.string()).min(3).max(12).describe("Hashtags sense el símbol #"),
  image_role: z
    .enum(["product", "backdrop", "hidden"])
    .describe(
      "product: la imatge és el protagonista i es mostra en una targeta; backdrop: només de fons; hidden: no s'usa"
    ),
  image_character: ImageCharacterSchema.nullable().describe(
    "Si algun personatge té source 'image', on són la cara i la boca del personatge a la imatge; si no, null"
  ),
});
export type Script = z.infer<typeof ScriptSchema>;

/** Opcions que l'usuari tria a la interfície. */
export const GenerationOptionsSchema = z.object({
  prompt: z.string().min(3),
  language: z.enum(["ca", "es", "en"]).default("ca"),
  characterCount: z.enum(["auto", "1", "2", "3"]).default("auto"),
  tone: z
    .enum(["witty", "absurd", "sarcastic", "wholesome", "dramatic", "promo"])
    .default("witty"),
  targetSeconds: z.number().int().min(15).max(60).default(40),
  ttsProvider: z.enum(["auto", "elevenlabs", "openai", "edge", "silent"]).default("auto"),
  /** auto: si la imatge mostra un personatge de menjar, s'usa retallat; drawn: sempre dibuixats; image: sempre la imatge */
  characterStyle: z.enum(["auto", "drawn", "image"]).default("auto"),
  brandHandle: z.string().default(""),
  platforms: z.array(z.enum(["reel", "tiktok"])).min(1).default(["reel", "tiktok"]),
});
export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>;

/** Una línia amb el seu àudio ja generat (o estimat). */
export type TimedLine = Line & {
  /** URL http o ruta relativa del fitxer d'àudio; null si és mode silenciós */
  audioUrl: string | null;
  /** Durada real de l'àudio en segons (o estimada en mode silenciós) */
  durationSeconds: number;
};

export type Platform = "reel" | "tiktok";

/** Props que rep la composició de Remotion. */
export type FoodTalkProps = {
  script: Script;
  lines: TimedLine[];
  imageUrl: string | null;
  /** PNG amb transparència del personatge retallat de la imatge (mode imatge); null si no n'hi ha */
  cutoutUrl: string | null;
  platform: Platform;
  brandHandle: string;
  language: "ca" | "es" | "en";
  /** Factor de velocitat aplicat a tots els àudios per encabir-ho en el temps màxim */
  playbackRate: number;
  musicUrl: string | null;
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const MAX_SECONDS = 60;
