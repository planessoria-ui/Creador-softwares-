import "dotenv/config";
import dns from "node:dns";
// A Windows amb xarxes sense IPv6 operatiu, Node pot fallar amb "Connection error": prioritzem IPv4.
dns.setDefaultResultOrder("ipv4first");
import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { GenerationOptionsSchema, ScriptSchema } from "./shared/schema";
import { PROJECT_ROOT, getBundle } from "./pipeline/render";
import { normalizeScript } from "./pipeline/script";
import { OUTPUT_ROOT, jobDir, loadJobs, runJob, saveJob, type Job } from "./pipeline/index";

const PORT = Number(process.env.PORT || 3000);
const DEMO_MODE = process.env.DEMO_MODE === "1";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(PROJECT_ROOT, "public")));
app.use("/output", express.static(OUTPUT_ROOT, { acceptRanges: true }));

const upload = multer({
  dest: path.join(PROJECT_ROOT, "uploads"),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

// ---------------------------------------------------------------------------
// Cua de feines (una a la vegada: el render ocupa tota la CPU)
// ---------------------------------------------------------------------------
const jobs = new Map<string, Job>();
for (const j of loadJobs()) {
  if (j.status !== "done" && j.status !== "error") {
    j.status = "error";
    j.error = "El servidor es va aturar mentre es processava.";
  }
  jobs.set(j.id, j);
}
const queue: string[] = [];
let running = false;

function newId(): string {
  return `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function pump(): Promise<void> {
  if (running) return;
  const id = queue.shift();
  if (!id) return;
  running = true;
  try {
    const job = jobs.get(id)!;
    await runJob(job, {}, DEMO_MODE || job.options.prompt === "__demo__");
  } finally {
    running = false;
    void pump();
  }
}

function enqueue(job: Job): void {
  jobs.set(job.id, job);
  saveJob(job);
  queue.push(job.id);
  void pump();
}

function publicJob(job: Job) {
  const base = `/output/${job.id}`;
  return {
    ...job,
    imageUrl: job.imageFile ? `${base}/${job.imageFile}` : null,
    outputs: job.outputs.map((o) => ({ ...o, url: `${base}/${o.file}` })),
    captionUrl: job.captionFile ? `${base}/${job.captionFile}` : null,
    captions: job.captionFile && fs.existsSync(path.join(jobDir(job.id), job.captionFile))
      ? fs.readFileSync(path.join(jobDir(job.id), job.captionFile), "utf8")
      : null,
    logs: job.logs.slice(-40),
    queuePosition: queue.indexOf(job.id) + 1,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.get("/api/config", (_req, res) => {
  res.json({
    hasClaudeKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    hasElevenLabs: Boolean(process.env.ELEVENLABS_API_KEY),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    demoMode: DEMO_MODE,
    brandHandle: process.env.BRAND_HANDLE || "",
    defaultLanguage: ["ca", "es", "en"].includes(process.env.DEFAULT_LANGUAGE || "") ? process.env.DEFAULT_LANGUAGE : "ca",
  });
});

app.get("/api/jobs", (_req, res) => {
  const list = [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  res.json(list.map(publicJob));
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Feina no trobada" });
  res.json(publicJob(job));
});

/** Crea una feina nova: imatge (opcional) + opcions. */
app.post("/api/jobs", upload.single("image"), (req, res) => {
  const parsed = GenerationOptionsSchema.safeParse({
    ...req.body,
    targetSeconds: Number(req.body.targetSeconds ?? 40),
    platforms: typeof req.body.platforms === "string" ? req.body.platforms.split(",").filter(Boolean) : req.body.platforms,
  });
  if (!parsed.success) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: "Opcions no vàlides", details: parsed.error.issues });
  }
  const id = newId();
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  let imageFile: string | null = null;
  if (req.file) {
    const ext = { "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[req.file.mimetype] ?? ".jpg";
    imageFile = `input${ext}`;
    fs.renameSync(req.file.path, path.join(dir, imageFile));
  }
  const job: Job = {
    id,
    createdAt: new Date().toISOString(),
    status: "queued",
    step: "En cua",
    progress: 0,
    options: parsed.data,
    imageFile,
    script: null,
    outputs: [],
    logs: [],
  };
  enqueue(job);
  res.status(202).json(publicJob(job));
});

/** Torna a generar els vídeos d'una feina amb un guió editat (sense trucar a Claude). */
app.post("/api/jobs/:id/rerender", (req, res) => {
  const source = jobs.get(req.params.id);
  if (!source) return res.status(404).json({ error: "Feina no trobada" });
  const parsed = ScriptSchema.safeParse(req.body.script);
  if (!parsed.success) return res.status(400).json({ error: "Guió no vàlid", details: parsed.error.issues });
  const id = newId();
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  if (source.imageFile) fs.copyFileSync(path.join(jobDir(source.id), source.imageFile), path.join(dir, source.imageFile));
  const sourceCutout = path.join(jobDir(source.id), "cutout.png");
  if (fs.existsSync(sourceCutout)) fs.copyFileSync(sourceCutout, path.join(dir, "cutout.png"));
  // Només se sobreescriuen les opcions que arriben explícitament (els valors per defecte de l'esquema no han de trepitjar les de la feina original).
  const options = { ...source.options };
  if (req.body.options && typeof req.body.options === "object") {
    const o = GenerationOptionsSchema.partial().safeParse(req.body.options);
    if (o.success) {
      for (const key of Object.keys(req.body.options) as (keyof typeof o.data)[]) {
        if (key in o.data) (options as Record<string, unknown>)[key] = o.data[key];
      }
    }
  }
  const job: Job = {
    id,
    createdAt: new Date().toISOString(),
    status: "queued",
    step: "En cua",
    progress: 0,
    options,
    imageFile: source.imageFile,
    script: normalizeScript(parsed.data),
    outputs: [],
    logs: [`Re-render de la feina ${source.id} amb guió editat.`],
  };
  enqueue(job);
  res.status(202).json(publicJob(job));
});

app.delete("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Feina no trobada" });
  if (job.status !== "done" && job.status !== "error") return res.status(409).json({ error: "La feina encara s'està processant" });
  jobs.delete(job.id);
  fs.rmSync(jobDir(job.id), { recursive: true, force: true });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`FoodTalk a punt: http://localhost:${PORT}`);
  if (DEMO_MODE) console.log("DEMO_MODE actiu: s'usa un guió d'exemple en comptes de Claude.");
  // Preescalfem el bundle de Remotion perquè la primera feina no s'esperi.
  getBundle((m) => console.log(m)).catch((e) => console.error("No s'ha pogut empaquetar Remotion:", e));
});
