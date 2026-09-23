import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import type { Character, Line, Script } from "../shared/schema";
import { mediaDurationSeconds } from "./media";

/**
 * Mode "vídeo IA": anima la foto sencera amb fal.ai.
 *  - nano-banana (edició d'imatge) crea les variants del personatge ("semblant però no igual")
 *  - Kling (imatge→vídeo) genera un clip per a cada rèplica a partir de la foto del qui parla
 *  - sync-lipsync sincronitza els llavis del clip amb la veu generada
 */

const I2V_MODEL = process.env.FAL_I2V_MODEL || "fal-ai/kling-video/v3/standard/image-to-video";
const LIPSYNC_MODEL = process.env.FAL_LIPSYNC_MODEL || "fal-ai/sync-lipsync/v2";
const IMAGE_EDIT_MODEL = process.env.FAL_IMAGE_EDIT_MODEL || "fal-ai/nano-banana/edit";
const PARALLEL = Math.max(1, Number(process.env.FAL_PARALLEL) || 3);

export function hasFalKey(): boolean {
  return Boolean(process.env.FAL_KEY);
}

function configure(): void {
  if (!process.env.FAL_KEY) throw new Error("Falta FAL_KEY al .env (clau de fal.ai)");
  fal.config({ credentials: process.env.FAL_KEY });
}

/** Reintenta una operació de xarxa (fetch failed, timeouts, 5xx) amb espera creixent. */
async function withRetry<T>(label: string, fn: () => Promise<T>, log: (m: string) => void = () => {}, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Errors de validació o de saldo no es reintenten
      if (/4\d\d|validation|unauthorized|forbidden|insufficient|balance/i.test(msg) && !/429|408/.test(msg)) throw err;
      if (i < attempts - 1) {
        const wait = 3000 * (i + 1);
        log(`  ${label}: error de xarxa (${msg.slice(0, 80)}); reintent ${i + 2}/${attempts} en ${wait / 1000} s`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function download(url: string, outFile: string, log: (m: string) => void = () => {}): Promise<void> {
  await withRetry(
    "baixada",
    async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No s'ha pogut baixar ${url}: ${res.status}`);
      const tmp = `${outFile}.part`;
      fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
      fs.renameSync(tmp, outFile);
    },
    log
  );
}

async function uploadFile(filePath: string, contentType: string, log: (m: string) => void = () => {}): Promise<string> {
  const data = fs.readFileSync(filePath);
  return withRetry("pujada", () => fal.storage.upload(new Blob([data], { type: contentType })), log);
}

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4" }[ext] || "application/octet-stream";
}

function hashOf(parts: unknown[]): string {
  return crypto.createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 12);
}

/** Executa tasques amb un límit de paral·lelisme. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runModel<T>(model: string, input: Record<string, unknown>, log: (m: string) => void, label: string): Promise<T> {
  const started = Date.now();
  let lastReport = 0;
  const result = await withRetry(
    label,
    () =>
      fal.subscribe(model as never, {
        input: input as never,
        logs: false,
        onQueueUpdate: (update) => {
          const elapsed = Date.now() - started;
          if (update.status === "IN_PROGRESS" && elapsed > 45_000 && elapsed - lastReport > 30_000) {
            lastReport = elapsed;
            log(`  ${label}: en procés (${Math.round(elapsed / 1000)} s)`);
          }
        },
      }),
    log
  );
  log(`  ${label}: fet en ${Math.round((Date.now() - started) / 1000)} s`);
  return result.data as T;
}

export type CharacterImages = Record<string, { url: string; file: string }>;

/**
 * Prepara la imatge de cada personatge: l'original de l'usuari per al primer amb source "image"
 * i variants generades per als altres. Desa els fitxers a <dir>/characters/.
 */
export async function prepareCharacterImages(
  script: Script,
  imagePath: string,
  dir: string,
  log: (m: string) => void
): Promise<CharacterImages> {
  configure();
  const outDir = path.join(dir, "characters");
  fs.mkdirSync(outDir, { recursive: true });
  const originalUrl = await uploadFile(imagePath, mimeFor(imagePath), log);
  const result: CharacterImages = {};
  let first = true;
  for (const c of script.characters) {
    if (first) {
      result[c.id] = { url: originalUrl, file: imagePath };
      first = false;
      continue;
    }
    const look = c.look?.trim() || `the same ${c.kind} character but with a different outfit and expression (${c.personality})`;
    const key = hashOf([IMAGE_EDIT_MODEL, look]);
    const file = path.join(outDir, `${c.id}-${key}.png`);
    if (fs.existsSync(file)) {
      log(`Variant de ${c.name} ja generada: es reutilitza.`);
      result[c.id] = { url: await uploadFile(file, "image/png", log), file };
      continue;
    }
    log(`Generant la variant de ${c.name} (${IMAGE_EDIT_MODEL})…`);
    const out = await runModel<{ images: { url: string }[] }>(
      IMAGE_EDIT_MODEL,
      {
        prompt: `${look}. Keep the same character identity, the same art style, the same framing and the same background scene. No text.`,
        image_urls: [originalUrl],
        num_images: 1,
        output_format: "png",
      },
      log,
      `variant ${c.name}`
    );
    const url = out.images?.[0]?.url;
    if (!url) throw new Error(`El model d'imatge no ha retornat cap imatge per a ${c.name}`);
    await download(url, file, log);
    result[c.id] = { url, file };
  }
  return result;
}

export type ClipResult = { file: string; durationSeconds: number | null };

function i2vInput(model: string, imageUrl: string, prompt: string, seconds: number): Record<string, unknown> {
  const negative = "blur, distort, low quality, text, subtitles, watermark, extra limbs";
  if (model.includes("/v3/")) {
    const d = String(Math.min(15, Math.max(3, Math.ceil(seconds))));
    return { start_image_url: imageUrl, prompt, duration: d, generate_audio: false, negative_prompt: negative, cfg_scale: 0.5 };
  }
  return { image_url: imageUrl, prompt, duration: seconds > 5 ? "10" : "5", negative_prompt: negative, cfg_scale: 0.5 };
}

/**
 * Genera el clip de cada línia (imatge→vídeo + sincronització labial) a <dir>/clips/.
 * Reutilitza clips ja generats si la línia, el pla i la imatge no han canviat.
 */
export async function generateLineClips(
  script: Script,
  lines: Line[],
  audioFiles: (string | null)[],
  images: CharacterImages,
  dir: string,
  log: (m: string) => void
): Promise<ClipResult[]> {
  configure();
  const clipsDir = path.join(dir, "clips");
  fs.mkdirSync(clipsDir, { recursive: true });
  const charById = new Map(script.characters.map((c) => [c.id, c] as [string, Character]));

  log(`Generant ${lines.length} clips amb ${I2V_MODEL} (${PARALLEL} alhora). Pot trigar uns minuts.`);
  const failures: string[] = [];
  const results = await mapLimit(lines, PARALLEL, async (line, i) => {
    try {
      return await generateOne(line, i);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`línia ${i + 1}: ${msg}`);
      log(`  clip ${i + 1}/${lines.length}: ERROR ${msg.slice(0, 160)}`);
      return null;
    }
  });
  if (failures.length > 0) {
    throw new Error(
      `${failures.length} de ${lines.length} clips han fallat (${failures[0]}). Els altres ja estan desats: prem «Torna a renderitzar amb aquest guió» per reintentar només els que falten.`
    );
  }
  return results as ClipResult[];

  async function generateOne(line: Line, i: number): Promise<ClipResult> {
    const character = charById.get(line.speaker) ?? script.characters[0];
    const image = images[character.id] ?? images[script.characters[0].id];
    const audioFile = audioFiles[i];
    const audioSeconds = audioFile ? await mediaDurationSeconds(audioFile) : null;
    const seconds = (audioSeconds ?? 0.5 + line.text.split(/\s+/).length * 0.4) + 1;
    const shot = line.shot?.trim() || `${character.name} talks expressively to the camera with natural gestures`;
    const prompt = `${shot}. The character is speaking, mouth moving naturally, expressive face and lively body language. Subtle camera movement, the environment is alive. Vertical 9:16 framing, cinematic, high quality.`;
    const key = hashOf([I2V_MODEL, LIPSYNC_MODEL, image.url === images[script.characters[0].id]?.url ? "original" : path.basename(image.file), prompt, line.text, character.voice, Boolean(audioFile)]);
    const outFile = path.join(clipsDir, `line-${String(i).padStart(2, "0")}-${key}.mp4`);
    if (fs.existsSync(outFile)) {
      log(`Clip ${i + 1} ja generat: es reutilitza.`);
      return { file: outFile, durationSeconds: await mediaDurationSeconds(outFile) };
    }

    const label = `clip ${i + 1}/${lines.length}`;
    // El resultat intermedi (clip sense sincronitzar) es desa per no tornar a pagar-lo si falla un pas posterior
    const i2vCache = path.join(clipsDir, `line-${String(i).padStart(2, "0")}-${key}.i2v.json`);
    let videoUrl: string | undefined;
    if (fs.existsSync(i2vCache)) {
      videoUrl = (JSON.parse(fs.readFileSync(i2vCache, "utf8")) as { url: string }).url;
      log(`  ${label}: vídeo ja generat abans; només cal sincronitzar.`);
    } else {
      const i2v = await runModel<{ video: { url: string } }>(I2V_MODEL, i2vInput(I2V_MODEL, image.url, prompt, seconds), log, `${label} vídeo`);
      videoUrl = i2v.video?.url;
      if (!videoUrl) throw new Error(`El model de vídeo no ha retornat cap clip per a la línia ${i + 1}`);
      fs.writeFileSync(i2vCache, JSON.stringify({ url: videoUrl, at: new Date().toISOString() }));
    }

    if (audioFile) {
      const audioUrl = await uploadFile(audioFile, "audio/mpeg", log);
      const syncMode = audioSeconds !== null && audioSeconds > seconds ? "bounce" : "cut_off";
      const input: Record<string, unknown> = LIPSYNC_MODEL.includes("sync-lipsync")
        ? { video_url: videoUrl, audio_url: audioUrl, sync_mode: syncMode }
        : { video_url: videoUrl, audio_url: audioUrl };
      const synced = await runModel<{ video: { url: string } }>(LIPSYNC_MODEL, input, log, `${label} llavis`);
      if (synced.video?.url) videoUrl = synced.video.url;
      else log(`  ${label}: la sincronització no ha retornat vídeo; s'usa el clip sense sincronitzar.`);
    }
    await download(videoUrl, outFile, log);
    return { file: outFile, durationSeconds: await mediaDurationSeconds(outFile) };
  }
}
