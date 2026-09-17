import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { FoodTalkProps, Platform } from "../shared/schema";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(here, "..", "..");
const ENTRY = path.join(PROJECT_ROOT, "src", "remotion", "index.ts");
const BUNDLE_DIR = path.join(PROJECT_ROOT, ".remotion-bundle");

let bundlePromise: Promise<string> | null = null;

/** Empaqueta la composició una sola vegada per procés (es reutilitza entre feines). */
export function getBundle(log: (m: string) => void = () => {}): Promise<string> {
  if (!bundlePromise) {
    log("Empaquetant la composició de Remotion…");
    bundlePromise = bundle({
      entryPoint: ENTRY,
      outDir: BUNDLE_DIR,
      publicDir: path.join(PROJECT_ROOT, "assets"),
      onProgress: (p) => {
        if (p % 25 === 0) log(`  bundle ${p}%`);
      },
    }).catch((e) => {
      bundlePromise = null;
      throw e;
    });
  }
  return bundlePromise;
}

function browserExecutable(): string | null {
  return process.env.REMOTION_BROWSER_EXECUTABLE || null;
}

function concurrency(): number {
  const n = Number(process.env.RENDER_CONCURRENCY);
  if (Number.isFinite(n) && n > 0) return n;
  return Math.max(1, Math.floor(os.cpus().length / 2));
}

/**
 * Serveix un directori per http a localhost, perquè Chrome (Remotion) pugui carregar
 * àudios i imatges del treball. Retorna la URL base i una funció per tancar-lo.
 */
export async function serveDirectory(dir: string): Promise<{ baseUrl: string; close: () => void }> {
  const mime: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = path.join(dir, urlPath);
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Content-Length": fs.statSync(filePath).size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { baseUrl: `http://127.0.0.1:${port}`, close: () => server.close() };
}

export type RenderResult = {
  outputPath: string;
  durationSeconds: number;
  /** props definitives (amb el guió retallat si calia) */
  props: FoodTalkProps;
};

export async function renderVideo(
  props: FoodTalkProps,
  platform: Platform,
  outputPath: string,
  log: (m: string) => void = () => {},
  onProgress: (fraction: number) => void = () => {}
): Promise<RenderResult> {
  const serveUrl = await getBundle(log);
  const inputProps: FoodTalkProps = { ...props, platform };
  const exe = browserExecutable();

  const composition = await selectComposition({
    serveUrl,
    id: "FoodTalk",
    inputProps,
    browserExecutable: exe,
    logLevel: "error",
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  log(`Renderitzant ${platform} (${(composition.durationInFrames / composition.fps).toFixed(1)} s)…`);
  let lastReported = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    outputLocation: outputPath,
    inputProps,
    browserExecutable: exe,
    concurrency: concurrency(),
    crf: 18,
    pixelFormat: "yuv420p",
    x264Preset: "medium",
    logLevel: "error",
    // Els dos formats accepten 1080x1920, H.264 + AAC, 30 fps.
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== lastReported && pct % 10 === 0) {
        lastReported = pct;
        log(`  ${platform}: ${pct}%`);
      }
      onProgress(progress);
    },
  });

  return {
    outputPath,
    durationSeconds: composition.durationInFrames / composition.fps,
    props: composition.props as FoodTalkProps,
  };
}
