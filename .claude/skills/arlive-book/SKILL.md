---
name: arlive-book
description: Plan an illustrated ARLive book (sketchbook, textbook chapter, story book) and produce copy-paste image prompts for ChatGPT plus the pages.json that ARLive imports. Use when someone wants to create, plan or write a book, sketchbook, chapter or set of pages for ARLive, write image prompts for its pages, decide which pages get AR, or build a pages.json.
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

## 1. Brief

Use what the user already said; ask once, in one message, only for what's missing:

- **Subject and topic** (e.g. Chemistry — water), **audience** (age / grade), **language** of the text.
- **Length**: default a cover + 6 spreads (13 pages).
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
  - **story**: 40–120 words for the audience, in the chosen language. ARLive shows it in the reader and
    on the AR info card. Keep the text *on the image* to the title and one short caption — image models
    letter long text badly; the full story lives in `pages.json`.
  - **picture**: what to draw, composition, focal subject.
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
    { "file": "cover.png", "title": "The Journey of a Water Drop", "story": "…", "ar": false },
    { "file": "spread-01.png", "side": "left", "title": "Lou in the sea", "story": "…", "ar": false },
    { "file": "spread-01.png", "side": "right", "title": "Meet H₂O", "story": "…", "ar": true }
  ]
}
```

- `file`: the name the user saves the ChatGPT image as (`cover.png`, `spread-01.png`, … — zero-padded so they sort).
- Spreads: one image holds two pages; ARLive splits it when "two-page spreads" is ticked. Use
  `"side": "left"` / `"right"` to give each half its own title, story and AR flag; an entry without `side`
  applies to both halves.
- Validate before saving: every page has `file`, titles ≤ 120 characters, stories ≤ 1000.

## 5. Hand-off to the user

End with these steps (adapt names):

1. In ChatGPT, paste each prompt from `prompts.md` and save the image with the file name shown.
2. In ARLive: **Books & targets → New book**, pick the subject and the same page size.
3. Drop **all images and `pages.json` together** on the book (tick "two-page spreads" if you made spreads).
4. **Preview book**: flip through; switch pages between *AR page* and *Story page* if needed.
5. Open each AR page, add its 3D model / 3D text / audio from the AR idea, **Save scene**.
6. **Compile**, then **Publish**, then **Print → Save as PDF** for the print shop (matte paper scans best).
