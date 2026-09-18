import fs from "node:fs";

/**
 * Retalla el personatge de la imatge (elimina el fons) i desa un PNG amb transparència.
 * Fa servir un model d'IA local (@imgly/background-removal-node); no cal cap clau.
 * Retorna false si no s'ha pogut fer (el vídeo llavors usa la imatge sencera).
 */
export async function cutoutCharacter(
  imagePath: string,
  outPath: string,
  log: (m: string) => void = () => {}
): Promise<boolean> {
  try {
    const { removeBackground } = await import("@imgly/background-removal-node");
    const started = Date.now();
    const blob = await removeBackground(imagePath, {
      model: (process.env.CUTOUT_MODEL as "small" | "medium") || "medium",
      output: { format: "image/png", quality: 1 },
    });
    fs.writeFileSync(outPath, Buffer.from(await blob.arrayBuffer()));
    log(`Personatge retallat del fons en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
    return true;
  } catch (err) {
    log(`No s'ha pogut retallar el fons (${(err as Error).message}); s'usarà la imatge sencera.`);
    return false;
  }
}
