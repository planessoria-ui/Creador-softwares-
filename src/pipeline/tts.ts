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

/**
 * Veus predefinides d'ElevenLabs (biblioteca per defecte dels comptes actuals).
 * Es poden sobreescriure amb ELEVENLABS_VOICE_<ARQUETIP>. Si una veu no existeix al
 * compte, es tria automàticament una de semblant entre les que hi ha.
 */
const ELEVENLABS_DEFAULT_VOICES: Record<VoiceArchetype, string> = {
  deep_male: "nPczCjzI2devNBz1zQrb", // Brian
  warm_male: "JBFqnCBsd6RMkjVDRZzb", // George
  energetic_male: "IKne3meq5aSn9XLyUdCD", // Charlie
  grumpy_old_male: "pqHfZKP75CvOlQylNhV4", // Bill
  warm_female: "XrExE9yKIg1WjnnlVkGX", // Matilda
  energetic_female: "cgSgspJ2msm6clMCkdW9", // Jessica
  sassy_female: "FGY2WhTYpPnrIDTdsKH5", // Laura
  squeaky: "pFZP5JQG7iQjIQuC4Bku", // Lily
  kid: "SAz9YHcvj6GT2YYXdXww", // River
};

type ElevenVoice = { voice_id: string; name: string; labels?: Record<string, string> };

/** Preferències per arquetip: paraules clau que sumen punts si apareixen a les etiquetes de la veu. */
const ELEVENLABS_PREFERENCES: Record<VoiceArchetype, { gender: "male" | "female" | "any"; age: string[]; keywords: string[] }> = {
  deep_male: { gender: "male", age: ["middle_aged", "middle-aged", "old"], keywords: ["deep", "authoritative", "resonant", "narration", "serious"] },
  warm_male: { gender: "male", age: ["middle_aged", "middle-aged"], keywords: ["warm", "friendly", "calm", "soothing", "gentle"] },
  energetic_male: { gender: "male", age: ["young"], keywords: ["energetic", "upbeat", "casual", "excited", "hype", "natural"] },
  grumpy_old_male: { gender: "male", age: ["old", "middle_aged", "middle-aged"], keywords: ["gruff", "raspy", "trustworthy", "wise", "deep", "crisp"] },
  warm_female: { gender: "female", age: ["middle_aged", "middle-aged"], keywords: ["warm", "soft", "calm", "soothing", "mature", "friendly"] },
  energetic_female: { gender: "female", age: ["young"], keywords: ["energetic", "upbeat", "expressive", "excited", "social", "bright"] },
  sassy_female: { gender: "female", age: ["young", "middle_aged", "middle-aged"], keywords: ["confident", "sassy", "expressive", "playful", "bold", "witty"] },
  squeaky: { gender: "female", age: ["young"], keywords: ["high", "childlike", "playful", "cute", "animated", "cartoon"] },
  kid: { gender: "any", age: ["young"], keywords: ["child", "kid", "young", "playful", "cartoon", "animated"] },
};

let elevenVoicesCache: Promise<ElevenVoice[]> | null = null;

async function listElevenLabsVoices(apiKey: string): Promise<ElevenVoice[]> {
  if (!elevenVoicesCache) {
    elevenVoicesCache = fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`ElevenLabs /voices ${res.status}`);
        const data = (await res.json()) as { voices?: ElevenVoice[] };
        return data.voices ?? [];
      })
      .catch((err) => {
        elevenVoicesCache = null;
        throw err;
      });
  }
  return elevenVoicesCache;
}

const elevenAssigned = new Map<string, string>(); // `${archetype}:${language}` -> voice_id

/**
 * Tria la veu d'ElevenLabs per a un arquetip: 1) variable d'entorn, 2) veu per defecte si existeix al compte,
 * 3) la veu del compte que millor encaixa amb les preferències (evitant repetir veus entre arquetips).
 */
async function elevenLabsVoice(archetype: VoiceArchetype, language: Language, apiKey: string): Promise<string> {
  const override = process.env[`ELEVENLABS_VOICE_${archetype.toUpperCase()}`];
  if (override) return override;
  const key = `${archetype}:${language}`;
  const cached = elevenAssigned.get(key);
  if (cached) return cached;

  let voices: ElevenVoice[] = [];
  try {
    voices = await listElevenLabsVoices(apiKey);
  } catch {
    return ELEVENLABS_DEFAULT_VOICES[archetype];
  }
  const ids = new Set(voices.map((v) => v.voice_id));
  const preferred = ELEVENLABS_DEFAULT_VOICES[archetype];
  if (ids.has(preferred)) {
    elevenAssigned.set(key, preferred);
    return preferred;
  }
  if (voices.length === 0) return preferred;

  const pref = ELEVENLABS_PREFERENCES[archetype];
  const langName = { ca: "catalan", es: "spanish", en: "english" }[language];
  const used = new Set(elevenAssigned.values());
  const scored = voices.map((v) => {
    const labels = Object.values(v.labels ?? {}).join(" ").toLowerCase() + " " + v.name.toLowerCase();
    let score = 0;
    const gender = (v.labels?.gender ?? "").toLowerCase();
    if (pref.gender === "any" || gender === pref.gender) score += 5;
    else if (gender) score -= 5;
    if (pref.age.some((a) => labels.includes(a))) score += 3;
    for (const k of pref.keywords) if (labels.includes(k)) score += 2;
    if (labels.includes(langName)) score += 3;
    if (used.has(v.voice_id)) score -= 4;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0].v.voice_id;
  elevenAssigned.set(key, chosen);
  return chosen;
}

async function synthesizeElevenLabs(
  text: string,
  character: Character,
  language: Language,
  outFile: string
): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Falta ELEVENLABS_API_KEY");
  const voiceId = await elevenLabsVoice(character.voice, language, apiKey);
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
    sassy_female: { name: "ca-ES-JoanaNeural", pitch: "-6%", rate: "+12%" },
    squeaky: { name: "ca-ES-JoanaNeural", pitch: "+35%", rate: "+18%" },
    kid: { name: "ca-ES-JoanaNeural", pitch: "+25%", rate: "+10%" },
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

/** Veu segura per idioma, per si la veu triada no està disponible al servei d'Edge. */
const EDGE_FALLBACK_VOICE: Record<Language, string> = {
  ca: "ca-ES-JoanaNeural",
  es: "es-ES-ElviraNeural",
  en: "en-US-JennyNeural",
};

async function synthesizeEdge(
  text: string,
  character: Character,
  language: Language,
  outFile: string,
  useFallbackVoice = false
): Promise<void> {
  const chosen = EDGE_VOICES[language][character.voice];
  const voice = useFallbackVoice ? { name: EDGE_FALLBACK_VOICE[language], pitch: "+0%", rate: "+5%" } : chosen;
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
      if (provider === "elevenlabs") await synthesizeElevenLabs(line.text, character, language, outFile);
      else if (provider === "openai") await synthesizeOpenAI(line.text, character, language, outFile);
      else await synthesizeEdge(line.text, character, language, outFile, attempt === 2);
      return { filePath: outFile };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
