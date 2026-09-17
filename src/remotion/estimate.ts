/** Estimació de durada quan no hi ha àudio (≈ 150 paraules per minut més una pausa). */
export function estimateDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, 0.5 + words * 0.4);
}
