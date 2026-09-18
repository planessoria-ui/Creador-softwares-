import fs from "node:fs";
import path from "node:path";
import {
  type GenerationOptions,
  type Platform,
  type Script,
  type TimedLine,
} from "../shared/schema";
import { demoScript, generateScript } from "./script";
import { cutoutCharacter } from "./cutout";
import { generateLineClips, hasFalKey, prepareCharacterImages } from "./falvideo";
import { PROJECT_ROOT, renderVideo, serveDirectory } from "./render";
import { estimateDurationSeconds, resolveProvider, synthesizeLine, type TtsProvider } from "./tts";

export type JobStatus = "queued" | "script" | "voices" | "rendering" | "done" | "error";

export type JobOutput = {
  platform: Platform;
  file: string; // ruta relativa a output/<id>/
  durationSeconds: number;
};

export type Job = {
  id: string;
  createdAt: string;
  status: JobStatus;
  step: string;
  progress: number; // 0..1 del pas actual
  options: GenerationOptions;
  imageFile: string | null; // nom del fitxer dins de output/<id>/
  script: Script | null;
  scriptModel?: string;
  ttsProvider?: TtsProvider;
  outputs: JobOutput[];
  captionFile?: string;
  error?: string;
  logs: string[];
};

export const OUTPUT_ROOT = path.join(PROJECT_ROOT, "output");

export function jobDir(id: string): string {
  return path.join(OUTPUT_ROOT, id);
}

export function saveJob(job: Job): void {
  fs.mkdirSync(jobDir(job.id), { recursive: true });
  fs.writeFileSync(path.join(jobDir(job.id), "job.json"), JSON.stringify(job, null, 2));
}

export function loadJobs(): Job[] {
  if (!fs.existsSync(OUTPUT_ROOT)) return [];
  return fs
    .readdirSync(OUTPUT_ROOT)
    .map((id) => path.join(OUTPUT_ROOT, id, "job.json"))
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p, "utf8")) as Job)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function pickMusic(): string | null {
  const dir = path.join(PROJECT_ROOT, "assets", "music");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|wav)$/i.test(f));
  if (files.length === 0) return null;
  return files[Math.floor(Math.random() * files.length)];
}

function buildCaptionText(script: Script, platform: Platform, language: GenerationOptions["language"]): string {
  const platformTags = platform === "tiktok" ? ["fyp", "parati", "tiktok"] : ["reels", "instagram", "explore"];
  const tags = [...new Set([...script.hashtags, ...platformTags])].map((t) => `#${t}`).join(" ");
  const title = platform === "tiktok" ? "TIKTOK" : "INSTAGRAM REEL";
  const langLabel = { ca: "Català", es: "Castellà", en: "Anglès" }[language];
  return `=== ${title} (${langLabel}) ===\n${script.caption}\n\n${tags}\n`;
}

export type PipelineHooks = {
  onUpdate?: (job: Job) => void;
};

/**
 * Executa tot el procés per a una feina: guió → veus → render per plataforma.
 * `useDemoScript` permet provar tot el procés sense clau d'API.
 */
export async function runJob(job: Job, hooks: PipelineHooks = {}, useDemoScript = false): Promise<Job> {
  const dir = jobDir(job.id);
  fs.mkdirSync(dir, { recursive: true });
  const update = (patch: Partial<Job>) => {
    Object.assign(job, patch);
    saveJob(job);
    hooks.onUpdate?.(job);
  };
  const log = (m: string) => {
    job.logs.push(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
    console.log(`[${job.id}] ${m}`);
    saveJob(job);
    hooks.onUpdate?.(job);
  };

  try {
    const imagePath = job.imageFile ? path.join(dir, job.imageFile) : null;

    // 1. Guió ---------------------------------------------------------------
    if (!job.script) {
      update({ status: "script", step: "Escrivint el guió amb Claude", progress: 0 });
      if (useDemoScript) {
        log("Mode demo: guió d'exemple (sense trucar a Claude).");
        job.script = demoScript(job.options.language);
      } else {
        const result = await generateScript(job.options, imagePath, log);
        job.script = result.script;
        job.scriptModel = result.model;
        log(`Guió rebut (${result.usage.input_tokens} tokens d'entrada, ${result.usage.output_tokens} de sortida).`);
      }
      fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(job.script, null, 2));
      update({ progress: 1 });
    } else {
      log("Guió ja existent: es reutilitza.");
      fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(job.script, null, 2));
    }
    const script = job.script;

    // Mode vídeo IA: la foto sencera s'anima amb fal.ai (cal FAL_KEY i imatge)
    const videoMode = job.options.characterStyle === "video";
    if (videoMode && !imagePath) throw new Error("El mode vídeo IA necessita una imatge.");
    if (videoMode && !hasFalKey()) throw new Error("El mode vídeo IA necessita FAL_KEY al .env (clau de fal.ai).");

    // 1b. Retall del personatge de la imatge (mode imatge) --------------------
    const usesImageCharacter = !videoMode && Boolean(imagePath && script.image_character && script.characters.some((c) => c.source === "image"));
    const cutoutFile = "cutout.png";
    if (usesImageCharacter && imagePath) {
      const cutoutPath = path.join(dir, cutoutFile);
      if (fs.existsSync(cutoutPath)) {
        log("Retall del personatge ja existent: es reutilitza.");
      } else {
        update({ step: "Retallant el personatge de la imatge" });
        const ok = await cutoutCharacter(imagePath, cutoutPath, log);
        if (!ok) fs.copyFileSync(imagePath, cutoutPath);
      }
    }

    // 2. Veus ---------------------------------------------------------------
    let provider = resolveProvider(job.options.ttsProvider);
    update({ status: "voices", step: `Generant les veus (${provider})`, progress: 0, ttsProvider: provider });
    const audioDir = path.join(dir, "audio");
    fs.mkdirSync(audioDir, { recursive: true });
    const timedLines: TimedLine[] = [];
    for (let i = 0; i < script.lines.length; i++) {
      const line = script.lines[i];
      const character = script.characters.find((c) => c.id === line.speaker) ?? script.characters[0];
      let filePath: string | null = null;
      // Si l'àudio d'aquesta línia ja existeix amb el mateix text, veu i proveïdor, es reutilitza (estalvia crèdits)
      const sidecar = path.join(audioDir, `line-${String(i).padStart(2, "0")}.json`);
      const existing = path.join(audioDir, `line-${String(i).padStart(2, "0")}.mp3`);
      const signature = JSON.stringify({ text: line.text, voice: character.voice, provider, language: job.options.language });
      if (provider !== "silent" && fs.existsSync(existing) && fs.existsSync(sidecar) && fs.readFileSync(sidecar, "utf8") === signature) {
        filePath = existing;
      } else if (provider !== "silent") {
        fs.rmSync(existing, { force: true });
        fs.rmSync(sidecar, { force: true });
        try {
          filePath = (await synthesizeLine(provider, line, character, job.options.language, audioDir, i)).filePath;
        } catch (err) {
          log(`Veu ${i + 1} ha fallat amb ${provider}: ${(err as Error).message}`);
          if (provider === "edge" || job.options.ttsProvider !== "auto") {
            log("Continuo sense àudio per a aquesta línia.");
          } else {
            provider = "edge";
            log("Provo amb el proveïdor gratuït (edge).");
            try {
              filePath = (await synthesizeLine(provider, line, character, job.options.language, audioDir, i)).filePath;
            } catch (err2) {
              log(`Edge també ha fallat: ${(err2 as Error).message}. Sense àudio per a aquesta línia.`);
            }
          }
        }
      }
      if (filePath && !fs.existsSync(sidecar)) fs.writeFileSync(sidecar, signature);
      timedLines.push({
        ...line,
        audioUrl: filePath ? `audio/${path.basename(filePath)}` : null,
        durationSeconds: filePath ? 0 : estimateDurationSeconds(line.text),
      });
      update({ progress: (i + 1) / script.lines.length, ttsProvider: provider });
    }
    const withAudio = timedLines.filter((l) => l.audioUrl).length;
    log(`Veus: ${withAudio}/${timedLines.length} línies amb àudio.`);

    // 2b. Mode vídeo IA: variants del personatge + un clip per línia -----------
    const clipFiles: (string | null)[] = timedLines.map(() => null);
    if (videoMode && imagePath) {
      update({ status: "rendering", step: "Generant els clips de vídeo amb IA (fal.ai)", progress: 0 });
      const images = await prepareCharacterImages(script, imagePath, dir, log);
      const audioFiles = timedLines.map((l) => (l.audioUrl ? path.join(dir, l.audioUrl) : null));
      let done = 0;
      const clips = await generateLineClips(script, script.lines, audioFiles, images, dir, (m) => {
        log(m);
        if (/clip \d+\/\d+ llavis: fet|ja generat/.test(m)) update({ progress: ++done / timedLines.length });
      });
      clips.forEach((c, i) => {
        clipFiles[i] = c.file;
        // La durada del segment és la del clip sincronitzat (conté la veu)
        if (c.durationSeconds && c.durationSeconds > 0) timedLines[i].durationSeconds = c.durationSeconds;
      });
      log(`Clips generats: ${clips.length}.`);
    }

    // 3. Render -------------------------------------------------------------
    update({ status: "rendering", step: "Renderitzant els vídeos", progress: 0, outputs: [] });
    const server = await serveDirectory(dir);
    const music = pickMusic();
    try {
      const lines = timedLines.map((l, i) => ({
        ...l,
        audioUrl: l.audioUrl ? `${server.baseUrl}/${l.audioUrl}` : null,
        videoUrl: clipFiles[i] ? `${server.baseUrl}/${path.relative(dir, clipFiles[i]!).split(path.sep).join("/")}` : null,
      }));
      // La música es carrega des del publicDir de Remotion (assets/), com un fitxer estàtic
      const musicUrl = music ? `music/${music}` : null;
      const platforms = job.options.platforms;
      let captionText = "";
      for (let p = 0; p < platforms.length; p++) {
        const platform = platforms[p];
        const outFile = `${platform}.mp4`;
        const result = await renderVideo(
          {
            script,
            lines,
            imageUrl: job.imageFile ? `${server.baseUrl}/${job.imageFile}` : null,
            cutoutUrl: usesImageCharacter ? `${server.baseUrl}/${cutoutFile}` : null,
            mode: videoMode ? "video" : "stage",
            platform,
            brandHandle: job.options.brandHandle,
            language: job.options.language,
            playbackRate: 1,
            musicUrl,
          },
          platform,
          path.join(dir, outFile),
          log,
          (fraction) => update({ progress: (p + fraction) / platforms.length })
        );
        job.outputs.push({ platform, file: outFile, durationSeconds: result.durationSeconds });
        // El guió definitiu pot haver perdut línies per encabir-se en 60 s
        job.script = result.props.script;
        captionText += buildCaptionText(result.props.script, platform, job.options.language) + "\n";
        update({ progress: (p + 1) / platforms.length });
      }
      fs.writeFileSync(path.join(dir, "captions.txt"), captionText);
      job.captionFile = "captions.txt";
    } finally {
      server.close();
    }

    update({ status: "done", step: "Fet", progress: 1 });
    log("Feina completada.");
    return job;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${message}`);
    update({ status: "error", error: message });
    return job;
  }
}
