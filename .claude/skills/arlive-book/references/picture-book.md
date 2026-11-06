# Picture-book pages: words, pictures and page turns

Every Sketchling story reads like a classic read-aloud picture book (think of Dr. Seuss's *Bright and
Early* books such as *Mr. Brown Can Moo! Can You?*): few words, big pictures, sounds to shout, and a
reason to turn every page. On a phone the reader shows **one page at a time with the words drawn on
the page**, and print puts the same words on the paper, so plan every page as a single page.
Never copy text from existing books; write originals in this spirit.

## The words on a page

- **Short lines.** 1–5 lines per page, 3–7 words per line, at most ~35 words. Each line in `story`
  is a line on the page (`\n` in pages.json), so break where a reader would breathe.
- **Read-aloud rhythm.** Repeat sentence shapes from page to page ("Lou can go up. / Lou can go
  down."), and use rhyme only when it comes naturally.
- **Sound words** between stars: `*Splish splash!*`, `*BUZZ*`, `*Hoo hoo*`. They're drawn big, bold
  and in colour. Use 1–2 per page, ideally on their own line, next to the thing making the sound.
- **A refrain that talks to the child**, coming back every few pages: "Can you?", "How about you?",
  "What would *you* do?". For a custom story it carries the parent's lesson ("Can you share too?").
- **Easy words** for the age: concrete nouns, strong verbs, no long clauses.

## Page turns make the suspense

The turn of the page is the storyteller's best tool:

1. **Set up, turn, pay off.** End a page on an unfinished sentence or a question, and answer it after
   the turn: "And then Lou heard…" → (turn) → "*CRASH!* Thunder!".
2. **Patterns of three.** Two pages set a pattern, the third breaks it with a surprise.
3. **Quiet, then loud.** A calm, nearly empty page just before a big, noisy one.
4. **Build up.** Each spread a little bigger, faster or sillier than the one before; the biggest
   moment comes about two-thirds of the way through.
5. **Come home.** The last pages echo the first line, then end with the refrain as a gentle question
   to the child, so the book ends with a conversation, not a lecture.

For a custom story the child is the hero (their first name), the things they love appear on the
pages, and the lesson the parent asked for is *shown* in the story and *asked* in the refrain.

## Pictures that leave room for the words

- Decide each page's **`textPosition`**: `top` (default for most pages), `bottom`, `middle` (rare)
  or `off` (only when the words are part of the picture, like the cover title). Write it in the plan
  and in pages.json.
- In the picture prompt, keep that band **quiet**: plain untouched paper or flat sky over roughly the
  top (or bottom) **third** of the page, no lettering, no important details. Put the character
  in the other part, facing or pointing towards the words.
- When a page has a sound word, draw its source (the bee, the owl, the rain) near the text band.
- **Cover**: `textPosition` `off`; the title is hand-lettered in the picture.
- **AR pages** still need rich detail for the camera: keep their quiet band to the top quarter and
  fill the rest with detail. Check the printed page with **Test in AR**.

## Example (one spread, two pages)

```json
{ "file": "spread-02.png", "side": "left", "title": "Lou in the sea", "textPosition": "top",
  "story": "Lou lives in the big blue sea.\nThe waves go up.\nThe waves go down.\n\n*Swish swash!*", "ar": false },
{ "file": "spread-02.png", "side": "right", "title": "Up, up, up", "textPosition": "top",
  "story": "Then the sun comes out.\nLou feels warm… and light…\nand lighter…\n\nWhere is Lou going?", "ar": true }
```
