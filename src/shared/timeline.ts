import { FPS, MAX_SECONDS, type Script, type TimedLine } from "./schema";

export const HOOK_SECONDS = 2.2;
export const GAP_SECONDS = 0.35;
export const END_CARD_SECONDS = 2.6;

export type Segment = {
  index: number;
  line: TimedLine;
  /** frame d'inici (inclou el ganxo inicial) */
  from: number;
  /** durada en frames, sense la pausa posterior */
  durationInFrames: number;
};

export type Timeline = {
  segments: Segment[];
  hookFrames: number;
  endCardFrom: number;
  totalFrames: number;
  playbackRate: number;
};

/**
 * Converteix les línies (amb durada d'àudio) en una línia de temps en frames.
 * Si el vídeo passa de MAX_SECONDS, primer accelera lleugerament l'àudio i,
 * si encara no hi cap, descarta línies del final (mantenint el remat).
 */
export function buildTimeline(
  script: Script,
  lines: TimedLine[],
  maxSeconds = MAX_SECONDS
): { timeline: Timeline; lines: TimedLine[]; script: Script } {
  const fixed = HOOK_SECONDS + END_CARD_SECONDS;
  let kept = [...lines];
  let punch = script.punchline_index;
  let playbackRate = 1;

  const spoken = (ls: TimedLine[], rate: number) =>
    ls.reduce((acc, l) => acc + l.durationSeconds / rate + GAP_SECONDS, 0);

  if (fixed + spoken(kept, 1) > maxSeconds) {
    const available = maxSeconds - fixed - kept.length * GAP_SECONDS;
    const raw = kept.reduce((a, l) => a + l.durationSeconds, 0);
    playbackRate = Math.min(1.25, Math.max(1, raw / Math.max(available, 1)));
  }
  // Si accelerant no n'hi ha prou, treu línies (de la penúltima cap enrere, conservant el remat).
  while (kept.length > 2 && fixed + spoken(kept, playbackRate) > maxSeconds) {
    const removeIdx = punch === kept.length - 1 ? kept.length - 2 : kept.length - 1;
    kept.splice(removeIdx, 1);
    if (removeIdx < punch) punch -= 1;
  }
  punch = Math.min(punch, kept.length - 1);

  const hookFrames = Math.round(HOOK_SECONDS * FPS);
  let cursor = hookFrames;
  const segments: Segment[] = kept.map((line, index) => {
    const durationInFrames = Math.max(1, Math.round((line.durationSeconds / playbackRate) * FPS));
    const seg = { index, line, from: cursor, durationInFrames };
    cursor += durationInFrames + Math.round(GAP_SECONDS * FPS);
    return seg;
  });
  const endCardFrom = cursor;
  const totalFrames = endCardFrom + Math.round(END_CARD_SECONDS * FPS);

  return {
    timeline: { segments, hookFrames, endCardFrom, totalFrames, playbackRate },
    lines: kept,
    script: { ...script, lines: kept.map(({ audioUrl: _a, durationSeconds: _d, ...l }) => l), punchline_index: punch },
  };
}
