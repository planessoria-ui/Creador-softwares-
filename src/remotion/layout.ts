import type { Platform } from "../shared/schema";
import { HEIGHT, WIDTH } from "../shared/schema";

/** Zones que la interfície de cada app tapa (en píxels a 1080x1920). */
export const SAFE: Record<Platform, { top: number; bottom: number; right: number; left: number }> = {
  reel: { top: 220, bottom: 420, right: 110, left: 40 },
  tiktok: { top: 160, bottom: 340, right: 150, left: 40 },
};

export function layoutFor(platform: Platform) {
  const safe = SAFE[platform];
  const usableW = WIDTH - safe.left - safe.right;
  const centerX = safe.left + usableW / 2;
  const hookTop = safe.top - 40;
  const cardTop = safe.top + 150;
  const cardH = 560;
  const stageBottom = HEIGHT - safe.bottom - 30;
  return { safe, usableW, centerX, hookTop, cardTop, cardH, stageBottom };
}

export const FONT_DISPLAY = "'Fredoka', 'Nunito', 'Segoe UI', Arial, sans-serif";
export const FONT_TEXT = "'Nunito', 'Fredoka', 'Segoe UI', Arial, sans-serif";
