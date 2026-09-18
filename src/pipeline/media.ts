import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { PROJECT_ROOT } from "./render";

const execFileP = promisify(execFile);

/** Troba l'ffmpeg que Remotion instal·la amb el seu compositor (no cal tenir-lo al sistema). */
export function findFfmpeg(): string | null {
  const dir = path.join(PROJECT_ROOT, "node_modules", "@remotion");
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith("compositor-")) continue;
    for (const bin of ["ffmpeg", "ffmpeg.exe"]) {
      const p = path.join(dir, name, bin);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Durada d'un fitxer d'àudio o vídeo en segons, o null si no es pot llegir. */
export async function mediaDurationSeconds(file: string): Promise<number | null> {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return null;
  try {
    await execFileP(ffmpeg, ["-i", file], { windowsHide: true });
  } catch (err) {
    // ffmpeg surt amb error quan no hi ha sortida, però escriu la informació a stderr
    const stderr = String((err as { stderr?: string }).stderr ?? "");
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return null;
}
