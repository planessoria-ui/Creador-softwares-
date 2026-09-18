# 🍅 FoodTalk — vídeos de menjar que parla per a Reels i TikTok

Poses **una imatge i una idea escrita** i obtens **un vídeo vertical (1080×1920, ≤ 60 s)** amb 1-3 personatges estil fruita/verdura/plat que parlen entre ells amb diàlegs còmics, a punt per pujar com a **Instagram Reel** i com a **TikTok**.

Com funciona per dins:

1. **Guió** — Claude mira la imatge i llegeix el prompt, i escriu un guió estructurat: personatges (quin menjar són, color, veu, personalitat), ganxo inicial, diàleg amb emocions i accions, remat final, crida a l'acció, descripció i hashtags.
2. **Veus** — cada línia es converteix en àudio amb ElevenLabs, OpenAI TTS o el servei gratuït d'Edge (segons les claus que tinguis). També es pot fer sense veu (només bafarades).
3. **Vídeo** — una composició de [Remotion](https://remotion.dev) dibuixa els personatges (SVG animats, boca sincronitzada amb l'àudio), la imatge, les bafarades, el ganxo i la targeta final, i ho exporta a MP4 H.264 per a cada plataforma amb les seves zones segures.

Tot es fa en local: no cal cap servei extern més que les APIs de guió i veu.

## Requisits

- Node.js 20 o superior
- Una clau de l'API de Claude (`ANTHROPIC_API_KEY`) per generar guions. Sense clau només funciona el mode de prova amb un guió d'exemple.
- Opcional: clau d'ElevenLabs o d'OpenAI per a veus més expressives. Sense cap de les dues es fa servir Edge TTS (gratuït, sense clau, amb veus en català, castellà i anglès).
- Chrome/Chromium: Remotion el descarrega sol la primera vegada. Si en tens un, indica'l a `REMOTION_BROWSER_EXECUTABLE`.

## Posada en marxa

```bash
npm install
cp .env.example .env      # omple ANTHROPIC_API_KEY i, si en tens, ELEVENLABS_API_KEY / OPENAI_API_KEY
npm start                 # obre http://localhost:3000
```

A la web:

1. Arrossega una imatge (opcional), escriu la idea, tria idioma, nombre de personatges, to i durada.
2. Prem **Genera el vídeo**. Veuràs el progrés (guió → veus → render) i els registres.
3. Quan acabi tindràs els MP4 de Reel i TikTok per descarregar, el text amb la descripció i els hashtags de cada plataforma, i el guió.
4. Pots **editar el guió** (frases, emocions, accions, tipus de menjar, veus) i **tornar a renderitzar** sense tornar a demanar-lo a Claude.

El botó **Prova amb un guió d'exemple** fa tot el procés sense trucar a Claude: serveix per comprovar que el render i les veus funcionen abans de gastar crèdits.

### Línia d'ordres

```bash
npm run generate -- --prompt "Dues pizzes discuteixen si la pinya és legal" --image foto.jpg
npm run generate -- --demo --tts silent            # prova ràpida sense claus
npm run generate -- --script output/<id>/script.json --image foto.jpg   # re-render d'un guió editat
npm run generate -- --help
```

Els resultats es desen a `output/<id>/`: `reel.mp4`, `tiktok.mp4`, `captions.txt`, `script.json`, els àudios i la imatge d'entrada.

### Remotion Studio

Per retocar l'estil del vídeo en directe (colors, fonts, disposició) obre l'estudi amb `npm run studio`. La composició `FoodTalk` mostra un exemple i `Gallery` mostra tots els personatges disponibles amb totes les emocions.

## Configuració (`.env`)

| Variable | Què fa |
|---|---|
| `ANTHROPIC_API_KEY` | Clau de Claude per escriure els guions. Alternativa: `ant auth login`. |
| `CLAUDE_MODEL` | Model per als guions. Per defecte `claude-opus-5`. |
| `TTS_PROVIDER` | `auto` (per defecte), `elevenlabs`, `openai`, `edge` o `silent`. `auto` tria el primer del qual tinguis clau i, si no n'hi ha cap, `edge`. |
| `ELEVENLABS_API_KEY` | Veus ElevenLabs (model `eleven_multilingual_v2`). Pots canviar les veus per arquetip amb `ELEVENLABS_VOICE_DEEP_MALE`, `ELEVENLABS_VOICE_SASSY_FEMALE`, etc. |
| `OPENAI_API_KEY` | Veus OpenAI (`gpt-4o-mini-tts`). Es poden sobreescriure amb `OPENAI_VOICE_<ARQUETIP>`. |
| `REMOTION_BROWSER_EXECUTABLE` | Ruta a un Chrome/Chromium local (per exemple el `headless_shell` de Playwright). Si es deixa buit, Remotion descarrega el seu. |
| `RENDER_CONCURRENCY` | Pestanyes de render en paral·lel. Per defecte la meitat dels nuclis. |
| `PORT` | Port del servidor web (3000). |
| `BRAND_HANDLE` | Text de marca per defecte per a la targeta final, p. ex. `@elmeunegoci`. |
| `DEFAULT_LANGUAGE` | Idioma preseleccionat a la web (`ca`, `es` o `en`). La web també recorda l'última tria. |
| `DEMO_MODE=1` | Totes les feines fan servir el guió d'exemple (per provar sense clau). |

**Música de fons:** deixa fitxers `.mp3` a `assets/music/` i se'n triarà un a l'atzar a volum baix. No se n'inclou cap per qüestions de llicència.

## Com es fa el guió (i com ajustar-lo)

El prompt del sistema és a `src/pipeline/script.ts`. Demana a Claude comèdia enginyosa (conflicte real entre personatges, rèpliques curtes, gir final que recontextualitza), sense acudits fàcils de "sóc una poma", i li dona les restriccions tècniques: quins menjars sabem dibuixar, quant dura una frase de veu, quantes paraules per línia. El resultat arriba com a JSON validat amb l'esquema de `src/shared/schema.ts` (structured outputs), de manera que mai falla per format.

Si vols un altre estil d'humor, canvia les guies de to (`TONE_GUIDES`) o el prompt del sistema. Si vols més tipus de menjar, afegeix el dibuix a `src/remotion/foods.tsx` i el nom a `FOOD_KINDS`.

## Formats de sortida

Els dos formats són 1080×1920, 30 fps, H.264 + AAC. La diferència és la **zona segura**: la interfície d'Instagram tapa més la part inferior i la de TikTok més la dreta, així que cada versió col·loca el ganxo, els personatges i la targeta final dins de l'espai visible de la seva app. El fitxer `captions.txt` inclou una descripció i hashtags per a cadascuna.

Si el guió és massa llarg per cabre en 60 segons, primer s'accelera lleugerament l'àudio (fins a 1,25×) i, si encara no hi cap, es descarten línies del final conservant sempre el remat.

## Estructura

```
src/
  server.ts            servidor web + API + cua de feines
  cli.ts               ús per línia d'ordres
  pipeline/
    script.ts          guió amb Claude (visió + structured outputs)
    tts.ts             veus: ElevenLabs / OpenAI / Edge / silenci
    render.ts          empaqueta i renderitza amb Remotion
    index.ts           orquestra una feina de principi a fi
  remotion/
    FoodTalk.tsx       composició principal
    foods.tsx          dibuixos SVG dels 34 menjars
    components/        personatge animat, bafarada, ganxo, targeta final…
    Gallery.tsx        galeria de personatges per a l'estudi
  shared/
    schema.ts          esquema del guió (zod) i tipus compartits
    timeline.ts        càlcul de temps i límit de 60 s
public/                interfície web
assets/fonts/          Fredoka i Nunito (SIL Open Font License)
assets/music/          música de fons opcional
output/                resultats (un directori per feina)
```

## Notes i limitacions

- **Remotion** és gratuït per a persones i empreses de fins a 3 persones; per a empreses més grans cal una llicència (vegeu [remotion.dev/license](https://remotion.dev/license)).
- El proveïdor **Edge** fa servir un servei no oficial de Microsoft que pot deixar de funcionar o estar bloquejat en algunes xarxes; si falla, el sistema continua sense àudio per a aquella línia. Per a producció, ElevenLabs o OpenAI són més fiables.
- El render és intensiu de CPU: en un portàtil normal un vídeo de 40 s triga entre 1 i 3 minuts. Les feines es processen d'una en una.
- La sincronització labial es calcula a partir del volum de l'àudio; és aproximada però prou convincent per a l'estil cartoon.
