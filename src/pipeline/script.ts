import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  FOOD_KINDS,
  ScriptSchema,
  type GenerationOptions,
  type Script,
} from "../shared/schema";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

const LANGUAGE_NAMES: Record<GenerationOptions["language"], string> = {
  ca: "català",
  es: "castellà (espanyol d'Espanya)",
  en: "anglès",
};

const TONE_GUIDES: Record<GenerationOptions["tone"], string> = {
  witty:
    "Humor intel·ligent: jocs de paraules, ironia fina, observacions agudes sobre la vida quotidiana. Res de acudits de pare fàcils.",
  absurd:
    "Humor absurd i surrealista: lògica interna impecable aplicada a premisses ridícules. Els personatges s'ho prenen molt seriosament.",
  sarcastic:
    "Sarcasme i mala llet simpàtica: els personatges es punxen entre ells amb rèpliques ràpides i afilades, però sense crueltat.",
  wholesome:
    "Humor tendre i amable: situacions entranyables amb un gir còmic. Que faci somriure, no riure a crits.",
  dramatic:
    "Paròdia de drama: telenovel·la, thriller o pel·lícula èpica, però amb menjar. Música imaginària, revelacions, traïcions.",
  promo:
    "Publicitari amb gràcia: el vídeo promociona el que surt a la imatge o al prompt, però el missatge comercial arriba a través de la comèdia, mai com un anunci llegit.",
};

function buildSystemPrompt(): string {
  return `Ets un guionista de comèdia especialitzat en vídeos curts verticals (Instagram Reels, TikTok) protagonitzats per menjars antropomòrfics: fruites, verdures i plats que parlen entre ells.

Escrius guions que es converteixen automàticament en un vídeo animat. Tens en compte aquestes restriccions tècniques:
- Cada línia de diàleg es converteix en veu sintètica. Escriu-les tal com s'han de pronunciar: sense acotacions entre parèntesis, sense emojis, sense majúscules per cridar, amb puntuació natural.
- Una línia de 12 paraules dura uns 4 segons de veu. El total de totes les línies ha de cabre en el temps objectiu que se't dona, amb marge (deixa un 15% lliure per al ganxo inicial i la targeta final).
- Els personatges es dibuixen amb un estil cartoon a partir del camp "kind". Només pots triar entre: ${FOOD_KINDS.join(", ")}.
- Els ids dels personatges han de ser curts, en minúscula i sense espais. Cada "speaker" ha de coincidir exactament amb un id.
- "punchline_index" assenyala la línia del remat final: normalment l'última o la penúltima.
- "hook" és el text que apareix escrit a pantalla els primers segons per aturar el dit de qui fa scroll: curt, intrigant o polèmic, mai explicatiu.

Regles d'humor:
- Comèdia enginyosa, no fàcil. Evita acudits de "sóc una poma, sóc rodona". Busca conflicte real: enveja, ego, expectatives, relacions, feina, tendències, la vida moderna, vista des del punt de vista del menjar.
- Cada personatge té una veu pròpia i reconeixible: un vol una cosa, l'altre s'hi oposa. El conflicte és el motor.
- Ritme de rèplica ràpida: línies curtes, sense monòlegs. Cap línia de més de 22 paraules.
- El gir final ha de recontextualitzar el que s'ha dit, no només acabar.
- Sense insults discriminatoris, sense sexe explícit, sense política partidista. Pot ser picant i irreverent.

Si l'usuari adjunta una imatge, analitza-la amb detall: quins menjars hi surten, quin ambient té, si és un producte, un plat, una cuina, un mercat... Tria els personatges perquè tinguin relació amb la imatge (el mateix menjar o un d'antagònic) i fes que el diàleg giri al voltant del que s'hi veu. Si la imatge mostra un producte o plat concret, posa "image_role" a "product".

Personatges a partir de la imatge ("source": "image"):
- Si la imatge mostra UN personatge de menjar amb cara (real, il·lustrat o generat per IA), es pot fer servir com a personatge: el programa el retalla del fons, l'anima i li superposa una boca que parla. En aquest cas el primer personatge amb source "image" és exactament el de la imatge (posa-li el "kind" del menjar que és, i el color que té); els altres personatges amb source "image" són variants seves ("semblants però no iguals": el programa els gira, els canvia una mica el to i els posa l'accessori que indiquis). Tria accessoris diferents per a cada variant i "none" per a l'original.
- Quan hi hagi personatges amb source "image", omple "image_character" amb la cara i la boca del personatge dins de la imatge, en coordenades de 0 a 1 (x cap a la dreta, y cap avall, relatives a l'amplada i l'alçada totals). Sigues precís: "mouth" és el centre de la boca i la seva amplada; "face" és el requadre de la cara sencera. Posa "image_role" a "backdrop" perquè l'escena de la imatge quedi de fons.
- Si no hi ha cap personatge amb source "image", posa "image_character" a null.

Retorna només el guió en el format estructurat demanat.`;
}

function buildUserPrompt(opts: GenerationOptions, hasImage: boolean): string {
  const count =
    opts.characterCount === "auto"
      ? "Tria tu el nombre de personatges (1, 2 o 3) segons el que demani la idea; normalment 2 funciona millor."
      : `Exactament ${opts.characterCount} personatge(s).`;
  const spoken = Math.round(opts.targetSeconds * 0.85);
  return [
    `Idioma dels diàlegs, el ganxo, la crida a l'acció, la descripció i els hashtags: ${LANGUAGE_NAMES[opts.language]}.`,
    `To: ${TONE_GUIDES[opts.tone]}`,
    count,
    `Durada objectiu del vídeo: ${opts.targetSeconds} segons. Les línies parlades han de sumar com a màxim ${spoken} segons.`,
    opts.brandHandle
      ? `Compte o marca que publica el vídeo: ${opts.brandHandle}. Pots esmentar-la a la crida a l'acció.`
      : "",
    hasImage
      ? "Adjunto la imatge que ha d'inspirar el vídeo."
      : "No hi ha imatge: inventa l'escena a partir del prompt, posa image_role a 'hidden', image_character a null i tots els personatges amb source 'drawn'.",
    hasImage && opts.characterStyle === "image"
      ? "MODE IMATGE: el protagonista ha de ser el personatge que surt a la imatge (source 'image') i, si hi ha més personatges del mateix menjar, també han de ser variants de la imatge (source 'image'). Omple image_character."
      : "",
    hasImage && opts.characterStyle === "drawn"
      ? "Tots els personatges han de ser dibuixats (source 'drawn'); image_character a null."
      : "",
    hasImage && opts.characterStyle === "auto"
      ? "Si la imatge mostra clarament un únic personatge de menjar amb cara, fes-lo protagonista amb source 'image' (i les variants també 'image'); si no, personatges dibuixats (source 'drawn') i image_character a null."
      : "",
    "",
    "Idea o prompt de l'usuari:",
    opts.prompt.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function mediaTypeFor(filePath: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export type ScriptGenerationResult = {
  script: Script;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

/**
 * Demana a Claude un guió estructurat a partir del prompt i, opcionalment, una imatge.
 */
export async function generateScript(
  opts: GenerationOptions,
  imagePath: string | null,
  log: (msg: string) => void = () => {}
): Promise<ScriptGenerationResult> {
  const client = new Anthropic();

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (imagePath) {
    const data = fs.readFileSync(imagePath).toString("base64");
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaTypeFor(imagePath), data },
    });
  }
  content.push({ type: "text", text: buildUserPrompt(opts, Boolean(imagePath)) });

  log(`Demanant el guió a ${MODEL}…`);

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content }],
    output_config: { format: betaZodOutputFormat(ScriptSchema) },
  });

  if (response.stop_reason === "refusal") {
    const why = response.stop_details?.explanation ?? "sense explicació";
    throw new Error(`Claude ha rebutjat la petició (${why}). Prova de reformular el prompt.`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("La resposta de Claude s'ha tallat (max_tokens). Torna-ho a provar.");
  }
  if (!response.parsed_output) {
    throw new Error("Claude no ha retornat un guió vàlid.");
  }

  const script = normalizeScript(response.parsed_output);
  return {
    script,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

/** Arregla petites inconsistències que el model pot generar (ids, colors, índexs). */
export function normalizeScript(raw: Script): Script {
  const script = ScriptSchema.parse(raw);
  const ids = new Set(script.characters.map((c) => c.id));
  const fallbackId = script.characters[0].id;
  const lines = script.lines
    .map((l) => ({
      ...l,
      text: l.text.replace(/\s+/g, " ").trim(),
      speaker: ids.has(l.speaker)
        ? l.speaker
        : (script.characters.find((c) => c.name.toLowerCase() === l.speaker.toLowerCase())?.id ??
          fallbackId),
    }))
    .filter((l) => l.text.length > 0);
  const characters = script.characters.map((c) => ({
    ...c,
    color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : "#ff7043",
  }));
  // Sense coordenades de la imatge, cap personatge pot venir de la imatge.
  const hasImageCharacter = Boolean(script.image_character);
  for (const c of characters) if (!hasImageCharacter) c.source = "drawn";
  return {
    ...script,
    characters,
    lines,
    punchline_index: Math.min(Math.max(0, script.punchline_index), lines.length - 1),
    hashtags: script.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")),
  };
}

/** Guió d'exemple per provar el render sense clau d'API. */
export function demoScript(language: GenerationOptions["language"] = "ca"): Script {
  const texts = {
    ca: {
      hook: "El tomàquet ha dit prou",
      lines: [
        ["tomaquet", "Cada dia el mateix: amanida, amanida, amanida. Jo tinc somnis, saps?", "angry", "shake"],
        ["alvocat", "Somnis? Jo vaig ser tendència tres anys seguits. Ara em posen a les torrades i ningú fa fotos.", "smug", "lean_in"],
        ["tomaquet", "Almenys a tu et paguen com un pis al centre.", "sad", "none"],
        ["alvocat", "I encara així m'obren i em troben marró per dins. Com tothom a dilluns.", "confused", "facepalm"],
        ["tomaquet", "Saps què? Deixem-ho. Anem-nos-en al gaspatxo. Allà ningú demana res.", "happy", "jump"],
        ["alvocat", "Als de la salsa guacamole els hi diran que vam morir com herois.", "smug", "point"],
      ],
      cta: "Segueix-nos per més drames de nevera",
      caption:
        "El tomàquet i l'alvocat tenen una conversa molt seriosa sobre la seva carrera professional. La nevera mai havia estat tan tensa.",
      hashtags: ["humor", "menjar", "alvocat", "tomaquet", "reels", "cuina", "comedia"],
    },
    es: {
      hook: "El tomate ha dicho basta",
      lines: [
        ["tomaquet", "Cada día lo mismo: ensalada, ensalada, ensalada. Yo tengo sueños, ¿sabes?", "angry", "shake"],
        ["alvocat", "¿Sueños? Yo fui tendencia tres años seguidos. Ahora me ponen en tostadas y nadie hace fotos.", "smug", "lean_in"],
        ["tomaquet", "Al menos a ti te pagan como un piso en el centro.", "sad", "none"],
        ["alvocat", "Y aun así me abren y me encuentran marrón por dentro. Como todo el mundo un lunes.", "confused", "facepalm"],
        ["tomaquet", "¿Sabes qué? Déjalo. Vámonos al gazpacho. Allí nadie pide nada.", "happy", "jump"],
        ["alvocat", "A los del guacamole les dirán que morimos como héroes.", "smug", "point"],
      ],
      cta: "Síguenos para más dramas de nevera",
      caption:
        "El tomate y el aguacate tienen una conversación muy seria sobre su carrera profesional. La nevera nunca había estado tan tensa.",
      hashtags: ["humor", "comida", "aguacate", "tomate", "reels", "cocina", "comedia"],
    },
    en: {
      hook: "The tomato has had enough",
      lines: [
        ["tomaquet", "Every single day: salad, salad, salad. I have dreams, you know?", "angry", "shake"],
        ["alvocat", "Dreams? I was trending three years in a row. Now they put me on toast and nobody takes pictures.", "smug", "lean_in"],
        ["tomaquet", "At least you get paid like a downtown apartment.", "sad", "none"],
        ["alvocat", "And they still cut me open and find me brown inside. Like everyone on a Monday.", "confused", "facepalm"],
        ["tomaquet", "You know what? Forget it. Let's go join the gazpacho. Nobody asks anything there.", "happy", "jump"],
        ["alvocat", "Tell the guacamole crew we died as heroes.", "smug", "point"],
      ],
      cta: "Follow for more fridge drama",
      caption:
        "A tomato and an avocado have a very serious talk about their careers. The fridge has never been this tense.",
      hashtags: ["funny", "food", "avocado", "tomato", "reels", "cooking", "comedy"],
    },
  }[language];

  return normalizeScript({
    title: "Drama de nevera",
    hook: texts.hook,
    scene: "Dins d'una nevera, a la nit, dos veïns de prestatge.",
    characters: [
      {
        id: "tomaquet",
        name: language === "en" ? "Tomato" : language === "es" ? "Tomate" : "Tomàquet",
        kind: "tomato",
        color: "#e53935",
        personality: "Dramàtic i cansat de la rutina, però amb esperança.",
        voice: "energetic_male",
        accessory: "none",
        source: "drawn",
      },
      {
        id: "alvocat",
        name: language === "en" ? "Avocado" : language === "es" ? "Aguacate" : "Alvocat",
        kind: "avocado",
        color: "#7cb342",
        personality: "Ex-influencer venut a l'èxit, cínic i orgullós.",
        voice: "sassy_female",
        accessory: "sunglasses",
        source: "drawn",
      },
    ],
    lines: texts.lines.map(([speaker, text, emotion, action]) => ({
      speaker,
      text,
      emotion: emotion as Script["lines"][number]["emotion"],
      action: action as Script["lines"][number]["action"],
    })),
    punchline_index: 5,
    cta: texts.cta,
    caption: texts.caption,
    hashtags: texts.hashtags,
    image_role: "product",
    image_character: null,
  });
}
