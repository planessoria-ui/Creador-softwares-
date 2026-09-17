import fs from "node:fs";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Character, GenerationOptions, Line, VoiceArchetype } from "../shared/schema";
export { estimateDurationSeconds } from "../remotion/estimate";

export type TtsProvider = "elevenlabs" | "openai" | "edge" | "silent";
type Language = GenerationOptions["language"];

export type TtsResult = {
  /** Ruta absoluta del fitxer d'àudio; null en mode silenciós */
  filePath: string | null;
};

/** Decideix quin proveïdor fer servir segons la configuració i les claus disponibles. */
export function resolveProvider(requested: GenerationOptions["ttsProvider"]): TtsProvider {
  if (requested !== "auto") return requested;
  const fromEnv = (process.env.TTS_PROVIDER || "auto") as GenerationOptions["ttsProvider"];
  if (fromEnv !== "auto") return fromEnv;
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "edge";
}

// ---------------------------------------------------------------------------
// ElevenLabs
// ---------------------------------------------------------------------------

/** Veus predefinides d'ElevenLabs. Es poden sobreescriure amb ELEVENLABS_VOICE_<ARQUETIP>. */
const ELEVENLABS_DEFAULT_VOICES: Record<VoiceArchetype, string> = {
  deep_male: "pNInz6obpgDQGcFmaJgB", // Adam
  warm_male: "ErXwobaYiN019PkbY4Cg", // Antoni
  energetic_male: "TxGEqnHXHKQubHvXuaqS", // Josh
  grumpy_old_male: "VR6AewLTigWBAiOoZG7X", // Arnold
  warm_female: "21m00Tcm4TlvDq8ikWAM", // Rachel
  energetic_female: "AZnzlk1XvdvUeBnXmlld", // Domi
  sassy_female: "EXAVITQu4vr4xnSDxMaL", // Bella
  squeaky: "MF3mGyEYCl7XN6t7lTaR", // Elli
  kid: "jBpfuIE2acCO8z3wKNLl", // Gigi
};

function elevenLabsVoice(archetype: VoiceArchetype): string {
  return (
    process.env[`ELEVENLABS_VOICE_${archetype.toUpperCase()}`] || ELEVENLABS_DEFAULT_VOICES[archetype]
  );
}

async function synthesizeElevenLabs(
  text: string,
  character: Character,
  outFile: string
): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Falta ELEVENLABS_API_KEY");
  const voiceId = elevenLabsVoice(character.voice);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
      voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
}

// ---------------------------------------------------------------------------
// OpenAI TTS
// ---------------------------------------------------------------------------

const OPENAI_VOICES: Record<VoiceArchetype, string> = {
  deep_male: "onyx",
  warm_male: "echo",
  energetic_male: "ash",
  grumpy_old_male: "onyx",
  warm_female: "nova",
  energetic_female: "shimmer",
  sassy_female: "coral",
  squeaky: "fable",
  kid: "sage",
};

async function synthesizeOpenAI(
  text: string,
  character: Character,
  language: Language,
  outFile: string
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY");
  const langName = { ca: "Catalan", es: "Spanish", en: "English" }[language];
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env[`OPENAI_VOICE_${character.voice.toUpperCase()}`] || OPENAI_VOICES[character.voice],
      input: text,
      instructions: `Speak in ${langName}. You are ${character.name}, a cartoon ${character.kind}. ${character.personality} Comedic delivery, expressive, quick pace.`,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
}

// ---------------------------------------------------------------------------
// Microsoft Edge (gratuït, sense clau)
// ---------------------------------------------------------------------------

type EdgeVoice = { name: string; pitch: string; rate: string };

const EDGE_VOICES: Record<Language, Record<VoiceArchetype, EdgeVoice>> = {
  ca: {
    deep_male: { name: "ca-ES-EnricNeural", pitch: "-12%", rate: "+0%" },
    warm_male: { name: "ca-ES-EnricNeural", pitch: "+0%", rate: "+5%" },
    energetic_male: { name: "ca-ES-EnricNeural", pitch: "+8%", rate: "+15%" },
    grumpy_old_male: { name: "ca-ES-EnricNeural", pitch: "-18%", rate: "-8%" },
    warm_female: { name: "ca-ES-JoanaNeural", pitch: "+0%", rate: "+5%" },
    energetic_female: { name: "ca-ES-JoanaNeural", pitch: "+8%", rate: "+15%" },
    sassy_female: { name: "ca-ES-AlbaNeural", pitch: "+4%", rate: "+10%" },
    squeaky: { name: "ca-ES-JoanaNeural", pitch: "+35%", rate: "+18%" },
    kid: { name: "ca-ES-AlbaNeural", pitch: "+25%", rate: "+10%" },
  },
  es: {
    deep_male: { name: "es-ES-AlvaroNeural", pitch: "-12%", rate: "+0%" },
    warm_male: { name: "es-ES-AlvaroNeural", pitch: "+0%", rate: "+5%" },
    energetic_male: { name: "es-ES-AlvaroNeural", pitch: "+8%", rate: "+15%" },
    grumpy_old_male: { name: "es-ES-AlvaroNeural", pitch: "-18%", rate: "-8%" },
    warm_female: { name: "es-ES-ElviraNeural", pitch: "+0%", rate: "+5%" },
    energetic_female: { name: "es-ES-ElviraNeural", pitch: "+8%", rate: "+15%" },
    sassy_female: { name: "es-ES-ElviraNeural", pitch: "+4%", rate: "+12%" },
    squeaky: { name: "es-ES-ElviraNeural", pitch: "+35%", rate: "+18%" },
    kid: { name: "es-ES-ElviraNeural", pitch: "+25%", rate: "+10%" },
  },
  en: {
    deep_male: { name: "en-US-GuyNeural", pitch: "-12%", rate: "+0%" },
    warm_male: { name: "en-US-ChristopherNeural", pitch: "+0%", rate: "+5%" },
    energetic_male: { name: "en-US-GuyNeural", pitch: "+8%", rate: "+15%" },
    grumpy_old_male: { name: "en-GB-RyanNeural", pitch: "-18%", rate: "-8%" },
    warm_female: { name: "en-US-JennyNeural", pitch: "+0%", rate: "+5%" },
    energetic_female: { name: "en-US-AriaNeural", pitch: "+8%", rate: "+15%" },
    sassy_female: { name: "en-US-MichelleNeural", pitch: "+4%", rate: "+12%" },
    squeaky: { name: "en-US-AnaNeural", pitch: "+25%", rate: "+15%" },
    kid: { name: "en-US-AnaNeural", pitch: "+10%", rate: "+8%" },
  },
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function synthesizeEdge(
  text: string,
  character: Character,
  language: Language,
  outFile: string
): Promise<void> {
  const voice = EDGE_VOICES[language][character.voice];
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice.name, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(escapeXml(text), { pitch: voice.pitch, rate: voice.rate });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (d: Buffer) => chunks.push(d));
    audioStream.on("close", () => resolve());
    audioStream.on("end", () => resolve());
    audioStream.on("error", (e: Error) => reject(e));
  });
  tts.close();
  const buf = Buffer.concat(chunks);
  if (buf.length < 500) throw new Error("Edge TTS ha retornat un àudio buit");
  fs.writeFileSync(outFile, buf);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------



export async function synthesizeLine(
  provider: TtsProvider,
  line: Line,
  character: Character,
  language: Language,
  outDir: string,
  index: number
): Promise<TtsResult> {
  if (provider === "silent") return { filePath: null };
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `line-${String(index).padStart(2, "0")}.mp3`);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (provider === "elevenlabs") await synthesizeElevenLabs(line.text, character, outFile);
      else if (provider === "openai") await synthesizeOpenAI(line.text, character, language, outFile);
      else await synthesizeEdge(line.text, character, language, outFile);
      return { filePath: outFile };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
