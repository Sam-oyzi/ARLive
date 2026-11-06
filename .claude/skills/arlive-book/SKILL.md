---
name: arlive-book
description: Plan an illustrated Sketchling (ARLive) picture book or custom story and produce copy-paste image prompts for ChatGPT plus the pages.json that the app imports. Use when someone wants to create, plan or write a book, story, custom story for a child, sketchbook or set of pages, write image prompts for its pages, decide where the words go and which pages get AR, or build a pages.json.
---

# ARLive book

You turn a topic into a printable, AR-ready book. Claude writes the plan, the stories and the image
prompts; the user generates the pictures in ChatGPT; ARLive imports pictures + `pages.json`, lets the
admin flip through the book, compile the AR pages and print it.

Output three files in `books/<slug>/` (create the folder):

| File | For |
|---|---|
| `plan.md` | The human-readable plan: every page with title, story, picture, AR idea |
| `prompts.md` | One copy-paste ChatGPT prompt per page, each with the file name to save it as |
| `pages.json` | Dropped into ARLive together with the images (schema below) |

**Every book is a read-aloud picture book.** Before planning, read
[references/picture-book.md](references/picture-book.md): short lines, sound words, a refrain, and
suspense on every page turn, with pictures that leave a quiet band for the words. The phone reader and
print draw the story onto each page, so the words and the picture are planned together.

## 1. Brief

Use what the user already said; ask once, in one message, only for what's missing:

- **Topic** (e.g. the water cycle, bedtime, sharing), **audience** (age), **language** of the text.
- **Custom story** (from an admin's story request): the child's first name (the hero), age, what they
  love, and the lesson the parent asked for. The lesson is shown in the story and asked in the refrain.
- **Length**: at least **20 story pages**, plus the cover. Default to **a cover + 10 spreads (21 pages total)**. Only make a shorter book when the user explicitly asks for a shorter format. Expand through meaningful story beats, not repeated filler.
- **Layout and style**: default is the **sketchbook spreads** look (cover + two-page watercolour spreads,
  like an open travel sketchbook). It is defined once, for Claude and ChatGPT alike, in
  [docs/chatgpt/arlive-book-studio-instructions.md](../../../docs/chatgpt/arlive-book-studio-instructions.md):
  use its style paragraphs word for word, its file names (`cover.png`, `spread-01.png`, …), its
  plan structure, its picture rules and its pages.json shape. Book page size in ARLive: **Sketchbook 3:4**.
  Single-page books and the other styles in [references/styles.md](references/styles.md) are options
  only when the user asks (then use A5 or another size).

## 2. Plan the pages

- Page 1 is the cover (right-hand page). Page 2 faces page 3, 4 faces 5, … — plan facing pages as pairs.
- Mark roughly **a third to a half of the pages as AR pages** (`"ar": true`): the ones where a 3D model,
  animation, video or narration adds real understanding (a molecule, an organ, a volcano, a machine).
  Cover, introduction and recap pages are usually story pages (`"ar": false`).
- For each page write:
  - **title** (≤ 60 characters)
  - **story**: picture-book text for the audience, in the chosen language: 1–5 short lines, at most ~35
    words, `*sound words*` between stars, ending on a question or an unfinished sentence when the next
    page pays it off (see [references/picture-book.md](references/picture-book.md)). The app draws it
    on the page; image models letter long text badly, so **no story text in the pictures**.
  - **textPosition**: `top` (most pages), `bottom`, `middle` or `off` (cover, or words already in the art).
  - **picture**: what to draw, composition, focal subject, and the quiet band left for the words.
  - **AR idea** (AR pages only): what appears when the page is scanned — e.g. "rotating H₂O molecule
    (GLB), 3D text 'H₂O' with a Float animation, narration". Suggest free model sources when useful:
    NIH 3D, NASA 3D Resources, Smithsonian 3D, Sketchfab (CC licences — check each model's licence).

## 3. Write the prompts

Every prompt = the chosen **style block**, unchanged, + **this page's subject**. Same style block on
every page is what makes the book look like one book. Rules for prompts are in
[references/styles.md](references/styles.md); the AR-specific rules matter most:

- **AR pages must be easy for a camera to recognise**: one large, detailed illustration with strong
  contrast and lots of edges; no big empty areas; no repeating patterns or perfect symmetry; every AR
  page clearly different from the others (composition, colours, subject).
- Ask for the right shape: single page **portrait 2:3** (1024×1536); spread **landscape 3:2** (1536×1024).
- **Room for the words**: on each page, keep the band from its `textPosition` (top or bottom third)
  as plain untouched paper, with the character in the rest of the page facing the words.
- Title in the image: say exactly what to write, in quotes, and ask for hand-lettering. Nothing else.

`prompts.md` format, one block per page:

````markdown
## Spread 02 — The sea / Meet H₂O  ·  save as `spread-02.png`  ·  AR: right page

```
<spread style paragraph, word for word> Scene: … The water molecule sits large and fully on the right page. …
```
````

Tell the user: for consistency, generate page 1 first, then in the same ChatGPT chat say
"same sketchbook, same paper and palette" for each next prompt (or attach page 1 as a reference).

## 4. pages.json

```json
{
  "pages": [
    { "file": "cover.png", "title": "The Journey of a Water Drop", "story": "…", "textPosition": "off", "ar": false },
    { "file": "spread-01.png", "side": "left", "title": "Lou in the sea", "story": "Lou lives in the big blue sea.\nThe waves go up.\n\n*Swish swash!*", "textPosition": "top", "ar": false },
    { "file": "spread-01.png", "side": "right", "title": "Up, up, up", "story": "Lou feels warm… and light…\n\nWhere is Lou going?", "textPosition": "top", "ar": true }
  ]
}
```

- `file`: the name the user saves the ChatGPT image as (`cover.png`, `spread-01.png`, … — zero-padded so they sort).
- Spreads: one image holds two pages; ARLive splits it when "two-page spreads" is ticked. Use
  `"side": "left"` / `"right"` to give each half its own title, story and AR flag; an entry without `side`
  applies to both halves.
- `story`: `\n` between lines, `*…*` around sound words. `textPosition`: `auto`, `top`, `middle`,
  `bottom` or `off` (the cover is always `off`).
- Validate before saving: every page has `file`, titles ≤ 120 characters, stories ≤ 1000, and the default manifest has at least 21 entries (cover + 20 story pages). Match each left/right image half to its own story beat.

## 5. Story order and visual continuity review

After generating illustrations, inspect them together in reading order against `pages.json` before
importing or handing off. Check that each half-spread depicts its own story beat and that a page turn
does not reveal a later event early. Keep the recurring characters' appearance, clothes, props and
relative body proportions consistent. Establish a reference illustration and record a simple scale
relationship between the child and each animal; a change in foreground perspective should not make
an animal look like it has changed size. Keep neighboring scenes' camera height and framing coherent,
using deliberate transitions rather than unexplained jumps. Check bedtime and other costume changes
against the narrative.

For Step Inside worlds, compare recurring animals' apparent size, initial forward view, panorama
horizon and room scale across worlds. Correct continuity defects and inspect the corrected pictures
again. Compile AR targets from the final corrected art; regenerate tracking data after replacing any
compiled page image. Record the check and corrections in the book's `continuity.md`.

## 6. Hand-off to the user

End with these steps (adapt names):

1. In ChatGPT, paste each prompt from `prompts.md` and save the image with the file name shown.
2. In the admin studio: **Books & AR pages → New book**, pick the category and the same page size
   (for a custom story, open the request and click **Start the book** instead).
3. Drop **all images and `pages.json` together** on the book (tick "two-page spreads" if you made spreads).
4. **Preview book** on a phone (or a narrow window): check each page's words sit in the quiet band;
   change a page's **Text on the page** in its editor if not. Switch pages between *AR page* and
   *Story page* if needed.
5. Open each AR page, add its 3D model / 3D text / audio from the AR idea, **Save scene**.
6. Optionally add **Voice narration** to each page (for Read to me).
7. **Compile**, then **Publish**, then **Print → Save as PDF** for the print shop (matte paper scans
   best). The print adds the story text and the QR code on the back cover.
