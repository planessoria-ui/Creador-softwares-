import "dotenv/config";
import dns from "node:dns";
// A Windows amb xarxes sense IPv6 operatiu, Node pot fallar amb "Connection error": prioritzem IPv4.
dns.setDefaultResultOrder("ipv4first");
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { GenerationOptionsSchema } from "./shared/schema";
import { jobDir, runJob, saveJob, type Job } from "./pipeline/index";

const { values } = parseArgs({
  options: {
    prompt: { type: "string", short: "p" },
    image: { type: "string", short: "i" },
    language: { type: "string", short: "l", default: "ca" },
    characters: { type: "string", short: "c", default: "auto" },
    tone: { type: "string", short: "t", default: "witty" },
    seconds: { type: "string", short: "s", default: "40" },
    tts: { type: "string", default: "auto" },
    style: { type: "string", default: "auto" },
    brand: { type: "string", default: process.env.BRAND_HANDLE || "" },
    platforms: { type: "string", default: "reel,tiktok" },
    script: { type: "string" },
    demo: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: false,
});

if (values.help || (!values.prompt && !values.demo && !values.script)) {
  console.log(`Ús: npm run generate -- --prompt "idea" [--image foto.jpg] [opcions]

Opcions:
  -p, --prompt       Idea del vídeo (obligatori si no s'usa --demo ni --script)
  -i, --image        Imatge d'entrada (jpg/png/webp)
  -l, --language     ca | es | en (per defecte ca)
  -c, --characters   auto | 1 | 2 | 3
  -t, --tone         witty | absurd | sarcastic | wholesome | dramatic | promo
  -s, --seconds      durada objectiu 15-60 (per defecte 40)
      --tts          auto | elevenlabs | openai | edge | silent
      --style        auto | image | drawn  (image: el personatge de la imatge, retallat i animat)
      --brand        text de marca per a la targeta final, p. ex. @elmeunegoci
      --platforms    reel,tiktok (per defecte tots dos)
      --script       fitxer script.json ja generat (salta la crida a Claude)
      --demo         usa un guió d'exemple (no cal clau d'API)
`);
  process.exit(0);
}

const options = GenerationOptionsSchema.parse({
  prompt: values.prompt || "(demo)",
  language: values.language,
  characterCount: values.characters,
  tone: values.tone,
  targetSeconds: Number(values.seconds),
  ttsProvider: values.tts,
  characterStyle: values.style,
  brandHandle: values.brand,
  platforms: String(values.platforms).split(",").map((s) => s.trim()).filter(Boolean),
});

const id = `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${Math.random().toString(36).slice(2, 7)}`;
const dir = jobDir(id);
fs.mkdirSync(dir, { recursive: true });

let imageFile: string | null = null;
if (values.image) {
  const src = path.resolve(String(values.image));
  imageFile = `input${path.extname(src).toLowerCase() || ".jpg"}`;
  fs.copyFileSync(src, path.join(dir, imageFile));
}

const job: Job = {
  id,
  createdAt: new Date().toISOString(),
  status: "queued",
  step: "En cua",
  progress: 0,
  options,
  imageFile,
  script: values.script ? JSON.parse(fs.readFileSync(String(values.script), "utf8")) : null,
  outputs: [],
  logs: [],
};
saveJob(job);

const result = await runJob(job, {}, Boolean(values.demo));
if (result.status === "error") {
  console.error(`\nHa fallat: ${result.error}`);
  process.exit(1);
}
console.log("\nVídeos generats:");
for (const out of result.outputs) {
  console.log(`  ${out.platform.padEnd(7)} ${path.join(dir, out.file)}  (${out.durationSeconds.toFixed(1)} s)`);
}
console.log(`  text    ${path.join(dir, "captions.txt")}`);
