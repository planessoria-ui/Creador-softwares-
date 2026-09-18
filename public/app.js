/* global fetch */
const $ = (sel) => document.querySelector(sel);

const FOOD_KINDS = ["apple","banana","tomato","carrot","broccoli","avocado","lemon","strawberry","pepper","orange","pizza","egg","bread","cheese","watermelon","eggplant","potato","mushroom","croissant","donut","grape","pear","onion","garlic","corn","peach","cherry","pineapple","burger","taco","sushi","cupcake","icecream","coffee"];
const EMOTIONS = ["neutral","happy","angry","surprised","sad","smug","confused","scared"];
const ACTIONS = ["none","jump","shake","spin","lean_in","facepalm","point"];
const VOICES = ["deep_male","warm_male","energetic_male","grumpy_old_male","warm_female","energetic_female","sassy_female","squeaky","kid"];
const ACCESSORIES = ["none","glasses","sunglasses","hat","bowtie","mustache","crown","headphones"];

let currentJobId = null;
let pollTimer = null;
let currentScript = null;

// ---- configuració -----------------------------------------------------------
async function loadConfig() {
  const cfg = await fetch("/api/config").then((r) => r.json());
  const warn = $("#config-warning");
  const msgs = [];
  if (!cfg.hasClaudeKey && !cfg.demoMode) msgs.push("No hi ha ANTHROPIC_API_KEY: només funcionarà el botó de prova amb guió d'exemple.");
  if (!cfg.hasElevenLabs && !cfg.hasOpenAI) msgs.push("Sense claus d'ElevenLabs ni OpenAI: les veus es faran amb el servei gratuït d'Edge (qualitat correcta però menys expressiva).");
  if (cfg.demoMode) msgs.push("DEMO_MODE actiu: totes les feines fan servir el guió d'exemple.");
  if (msgs.length) { warn.textContent = msgs.join(" "); warn.classList.remove("hidden"); }
  if (cfg.brandHandle && !$("#brand").value) $("#brand").value = cfg.brandHandle;
  // Idioma: l'última tria de l'usuari; si no n'hi ha, el del .env (DEFAULT_LANGUAGE)
  let remembered = null;
  try { remembered = localStorage.getItem("foodtalk.language"); } catch {}
  $("#form").language.value = remembered || cfg.defaultLanguage || "ca";
}
$("#form").language.addEventListener("change", (e) => {
  try { localStorage.setItem("foodtalk.language", e.target.value); } catch {}
});

// ---- imatge -----------------------------------------------------------------
const drop = $("#drop");
const imageInput = $("#image");
function showPreview(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  $("#preview").src = url;
  $("#preview").classList.remove("hidden");
  $("#drop-text").innerHTML = `<small>${file.name} · fes clic per canviar-la</small>`;
}
imageInput.addEventListener("change", () => showPreview(imageInput.files[0]));
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    const dt = new DataTransfer();
    dt.items.add(file);
    imageInput.files = dt.files;
    showPreview(file);
  }
});

// ---- enviament --------------------------------------------------------------
function collectForm(demo) {
  const form = $("#form");
  const fd = new FormData();
  if (imageInput.files[0]) fd.append("image", imageInput.files[0]);
  fd.append("prompt", demo ? "__demo__" : form.prompt.value);
  fd.append("language", form.language.value);
  fd.append("characterCount", form.characterCount.value);
  fd.append("tone", form.tone.value);
  fd.append("targetSeconds", form.targetSeconds.value);
  fd.append("ttsProvider", form.ttsProvider.value);
  fd.append("characterStyle", form.characterStyle.value);
  fd.append("brandHandle", form.brandHandle.value.trim());
  const platforms = [...form.querySelectorAll("input[name=platforms]:checked")].map((i) => i.value);
  fd.append("platforms", platforms.join(","));
  return fd;
}

async function submit(demo) {
  const platforms = [...$("#form").querySelectorAll("input[name=platforms]:checked")];
  if (platforms.length === 0) { alert("Tria almenys un format."); return; }
  if (!demo && !$("#prompt").value.trim()) { alert("Escriu una idea o prompt."); return; }
  $("#submit").disabled = true;
  try {
    const res = await fetch("/api/jobs", { method: "POST", body: collectForm(demo) });
    const job = await res.json();
    if (!res.ok) throw new Error(job.error || "Error desconegut");
    watch(job.id);
  } catch (err) {
    alert("No s'ha pogut crear la feina: " + err.message);
  } finally {
    $("#submit").disabled = false;
  }
}
$("#form").addEventListener("submit", (e) => { e.preventDefault(); submit(false); });
$("#demo").addEventListener("click", () => submit(true));

// ---- seguiment --------------------------------------------------------------
function watch(id) {
  currentJobId = id;
  clearInterval(pollTimer);
  $("#empty").classList.add("hidden");
  $("#result").classList.add("hidden");
  $("#progress").classList.remove("hidden");
  $("#result-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  const tick = async () => {
    const job = await fetch(`/api/jobs/${id}`).then((r) => r.json());
    renderProgress(job);
    if (job.status === "done" || job.status === "error") {
      clearInterval(pollTimer);
      if (job.status === "done") renderResult(job);
      loadHistory();
    }
  };
  tick();
  pollTimer = setInterval(tick, 1500);
  loadHistory();
}

const STEP_ORDER = ["script", "voices", "rendering", "done"];
function renderProgress(job) {
  const idx = STEP_ORDER.indexOf(job.status);
  document.querySelectorAll(".steps span").forEach((el) => {
    const i = STEP_ORDER.indexOf(el.dataset.step);
    el.className = i < idx || job.status === "done" ? "done" : i === idx ? "active" : "";
  });
  const overall = job.status === "done" ? 1 : job.status === "error" ? 0 : Math.max(0, idx) / 3 + (job.progress || 0) / 3;
  $("#bar-fill").style.width = `${Math.round(overall * 100)}%`;
  $("#step-text").textContent = job.status === "queued" && job.queuePosition > 0 ? `En cua (posició ${job.queuePosition})` : job.step;
  $("#logs").textContent = (job.logs || []).join("\n");
  $("#logs").scrollTop = $("#logs").scrollHeight;
  const old = $("#progress .error-box");
  if (old) old.remove();
  if (job.status === "error") {
    const box = document.createElement("div");
    box.className = "error-box";
    box.textContent = job.error;
    $("#progress").appendChild(box);
  }
}

function renderResult(job) {
  $("#result").classList.remove("hidden");
  const labels = { reel: "Instagram Reel", tiktok: "TikTok" };
  $("#videos").innerHTML = job.outputs
    .map(
      (o) => `<div class="video-card">
        <strong>${labels[o.platform] || o.platform}</strong> <span class="muted">· ${o.durationSeconds.toFixed(0)} s</span>
        <video controls playsinline src="${o.url}"></video>
        <a href="${o.url}" download="${job.id}-${o.platform}.mp4">Descarrega MP4</a>
      </div>`
    )
    .join("");
  $("#captions").textContent = job.captions || "";
  currentScript = job.script;
  renderScriptEditor(job.script);
  renderMouthEditor(job);
}

// ---- editor de la boca (mode imatge) -----------------------------------------
function renderMouthEditor(job) {
  const box = $("#mouth-editor");
  const geo = job.script && job.script.image_character;
  if (!geo || !job.imageUrl) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const img = $("#mouth-img");
  img.src = job.imageUrl;
  $("#mouth-w").value = geo.mouth.w;
  const paint = () => {
    const g = currentScript.image_character;
    const m = $("#mouth-marker");
    m.style.left = `${g.mouth.x * 100}%`;
    m.style.top = `${g.mouth.y * 100}%`;
    m.style.width = `${g.mouth.w * 100}%`;
  };
  img.onload = paint;
  paint();
  img.onclick = (e) => {
    const r = img.getBoundingClientRect();
    currentScript.image_character.mouth.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    currentScript.image_character.mouth.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    paint();
  };
  $("#mouth-w").oninput = (e) => { currentScript.image_character.mouth.w = Number(e.target.value); paint(); };
}

$("#copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#captions").textContent);
  $("#copy").textContent = "Copiat!";
  setTimeout(() => ($("#copy").textContent = "Copia"), 1500);
});

// ---- editor de guió ---------------------------------------------------------
function options(list, value) {
  return list.map((v) => `<option value="${v}" ${v === value ? "selected" : ""}>${v}</option>`).join("");
}
function renderScriptEditor(script) {
  const el = $("#script-editor");
  el.innerHTML = `
    <div class="script-meta">
      <label>Ganxo inicial <input data-field="hook" value="${escapeHtml(script.hook)}" /></label>
      <label>Crida a l'acció <input data-field="cta" value="${escapeHtml(script.cta)}" /></label>
    </div>
    <h4>Personatges</h4>
    ${script.characters
      .map(
        (c, i) => `<div class="line-row" data-char="${i}">
          <input data-cfield="name" value="${escapeHtml(c.name)}" title="Nom" />
          <select data-cfield="kind">${options(FOOD_KINDS, c.kind)}</select>
          <select data-cfield="voice">${options(VOICES, c.voice)}</select>
          <select data-cfield="accessory">${options(ACCESSORIES, c.accessory)}</select>
        </div>`
      )
      .join("")}
    <h4>Diàleg</h4>
    ${script.lines
      .map(
        (l, i) => `<div class="line-row" data-line="${i}">
          <select data-lfield="speaker">${options(script.characters.map((c) => c.id), l.speaker)}</select>
          <textarea data-lfield="text">${escapeHtml(l.text)}</textarea>
          <select data-lfield="emotion">${options(EMOTIONS, l.emotion)}</select>
          <select data-lfield="action">${options(ACTIONS, l.action)}</select>
        </div>`
      )
      .join("")}
  `;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function readScriptEditor() {
  const s = JSON.parse(JSON.stringify(currentScript));
  const el = $("#script-editor");
  s.hook = el.querySelector('[data-field="hook"]').value;
  s.cta = el.querySelector('[data-field="cta"]').value;
  el.querySelectorAll("[data-char]").forEach((row) => {
    const c = s.characters[Number(row.dataset.char)];
    row.querySelectorAll("[data-cfield]").forEach((inp) => (c[inp.dataset.cfield] = inp.value));
  });
  el.querySelectorAll("[data-line]").forEach((row) => {
    const l = s.lines[Number(row.dataset.line)];
    row.querySelectorAll("[data-lfield]").forEach((inp) => (l[inp.dataset.lfield] = inp.value));
  });
  return s;
}
$("#rerender").addEventListener("click", async () => {
  if (!currentJobId || !currentScript) return;
  const form = $("#form");
  const platforms = [...form.querySelectorAll("input[name=platforms]:checked")].map((i) => i.value);
  const res = await fetch(`/api/jobs/${currentJobId}/rerender`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script: readScriptEditor(),
      options: { ttsProvider: form.ttsProvider.value, characterStyle: form.characterStyle.value, brandHandle: form.brandHandle.value.trim(), platforms: platforms.length ? platforms : undefined },
    }),
  });
  const job = await res.json();
  if (!res.ok) { alert(job.error || "Error"); return; }
  watch(job.id);
});

// ---- historial --------------------------------------------------------------
async function loadHistory() {
  const jobs = await fetch("/api/jobs").then((r) => r.json());
  const el = $("#history");
  if (!jobs.length) { el.textContent = "Res encara."; return; }
  el.innerHTML = jobs
    .map(
      (j) => `<div class="history-item" data-id="${j.id}">
        ${j.imageUrl ? `<img src="${j.imageUrl}" alt="" />` : `<div class="thumb-empty"></div>`}
        <div>
          <strong>${escapeHtml(j.script ? j.script.title : j.options.prompt.slice(0, 60))}</strong><br />
          <small class="muted">${new Date(j.createdAt).toLocaleString("ca-ES")} · ${j.options.language} · ${j.outputs.map((o) => o.platform).join(", ") || "—"}</small>
        </div>
        <div>
          <span class="status ${j.status}">${j.status}</span>
          ${j.status === "done" || j.status === "error" ? `<button class="small ghost" data-del="${j.id}" title="Esborra">✕</button>` : ""}
        </div>
      </div>`
    )
    .join("");
  el.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Esborrar aquesta feina i els seus vídeos?")) return;
      await fetch(`/api/jobs/${b.dataset.del}`, { method: "DELETE" });
      loadHistory();
    })
  );
  el.querySelectorAll(".history-item").forEach((item) => item.addEventListener("click", () => watch(item.dataset.id)));
}

loadConfig();
loadHistory();
