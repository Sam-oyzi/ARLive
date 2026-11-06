# Style blocks

Paste the style block unchanged at the start of every prompt in a book, then add the page's subject.
Replace `{SHAPE}` with the page shape:

- single page: `Vertical portrait page, 2:3 aspect ratio (1024×1536).`
- two-page spread: `Two facing pages of an open book, landscape 3:2 aspect ratio (1536×1024), with the gutter in the exact centre.`

## Watercolour sketchbook, single pages

For single-page books. The default **spread** style lives in docs/chatgpt/arlive-book-studio-instructions.md.

```
Hand-drawn sketchbook page on cream watercolour paper. {SHAPE} Loose fineliner ink linework, sepia and
indigo washes bleeding past the lines, soft shadow at the page edge, visible paper grain and deckled
texture, small hand-lettered notes. No borders, no photo frame, no digital look. Fill the page edge to edge.
```

## Clean textbook illustration

```
Clean educational textbook illustration. {SHAPE} Crisp vector-like shapes with soft gradients, bright
but balanced palette, white page with a light pastel background panel, clear labels in a friendly
rounded sans-serif. No borders. Fill the page edge to edge.
```

## Children's storybook

```
Warm children's storybook illustration in gouache. {SHAPE} Rounded friendly shapes, rich saturated
colours, gentle textured brushwork, cosy lighting, one clear focal scene. No borders. Fill the page edge to edge.
```

## Scientific field notebook

```
Naturalist's field notebook page on aged off-white paper. {SHAPE} Detailed graphite and ink botanical /
anatomical drawing style with light watercolour tints, handwritten annotations and leader lines, small
measurement scale. No borders. Fill the page edge to edge.
```

# Prompt rules

1. **Subject sentence**: after the style block write `Subject: …` — the main illustration, large and
   centred (or the composition you planned), and what surrounds it.
2. **Lettering**: `Hand-lettered title at the top: "<exact title>".` Optionally one caption of at most
   ~8 words: `Small handwritten caption near the drawing: "<caption>".` Never ask for paragraphs.
3. **AR pages** (camera recognition): add
   `Rich detail and strong light/dark contrast across the whole page, many distinct shapes and edges,
   no large empty areas, no repeating pattern.`
   and make each AR page's composition clearly different from the other AR pages.
4. **Story pages** can be calmer: more paper, a smaller vignette, room to breathe.
4b. **Room for the words** (every page but the cover): add
   `Leave the top third of the page as plain, untouched paper with no drawing and no lettering; place
   the subject in the lower two-thirds, facing up towards that space.` (swap top/lower for a page
   whose `textPosition` is `bottom`).
5. **Cover**: `Book cover: large hand-lettered title "<book title>", a hero illustration of <…>,
   decorative <style-appropriate> ornaments.` Keep it a single page even if the book uses spreads.
6. **Consistency**: mention recurring elements by the same words on every page (a character's name and
   look, a colour palette, a mascot).
7. **Language**: lettering in the book's language; keep it short and check the spelling in the result —
   regenerate if letters come out garbled.

# Example (watercolour sketchbook, single page, AR)

```
Hand-drawn sketchbook page on cream watercolour paper. Vertical portrait page, 2:3 aspect ratio
(1024×1536). Loose fineliner ink linework, sepia and indigo washes bleeding past the lines, soft shadow at
the page edge, visible paper grain and deckled texture, small hand-lettered notes. No borders, no photo
frame, no digital look. Fill the page edge to edge.
Subject: a large ball-and-stick water molecule (one red oxygen, two white hydrogens at 104.5°) floating
above a glass of water, with tiny droplets and a thermometer sketched around it.
Hand-lettered title at the top: "Meet H₂O". Small handwritten caption near the drawing: "bond angle 104.5°".
Rich detail and strong light/dark contrast across the whole page, many distinct shapes and edges, no
large empty areas, no repeating pattern.
```
