# Translating a book

A translation is a new telling of the same picture book, read aloud to a child with the same pictures.
Translate the story, not the sentences: write what a children's author in that language would write
for these pictures, then check it says the same things.

## Every language

- **Keep the book's beats, not the English lines.** Keep each page's moment, its refrain, its sound
  words and the hook that makes the child turn the page. Inside a page, reorder, merge or split lines
  so the language reads naturally; the line breaks are yours, at that language's natural pauses.
- **No calques.** If a phrase is literal English, rewrite it: "a silver song" is not Arabic or French,
  "you can do it!" has its own idiom in each language.
- **Sound words in the language's own sounds**, between `*stars*`, not transliterated English
  (a bird is *زَقْ زَقْ* in Arabic, *cui-cui* in French, not "pip pip").
- **Names and animals stay the same** across the book: pick one spelling (سارة, Sarra) and one gender
  per animal where the language marks it, and write them in `continuity.md`.
- **Addressing the reader.** Where the language marks gender in "you", use the plural for a book any
  child reads (Arabic «أنتم», French «vous» or a turn of phrase), or the hero's gender for a custom story.
- **The title** can change to what reads best in that language; the publisher has the last word
  (Sarra's Arabic title is «سارة والأسد الصغير الضائع»: the lost little lion, not a literal "roar").
- **Same length on the page.** The translation sits in the same quiet band as the original: keep it
  within about 120% of the original's length, and check it on the page (below).

## Arabic

- **Fuṣḥā (Modern Standard Arabic)** for narration and dialogue: it suits reading aloud anywhere and
  matches school reading. Use dialect only if the publisher asks.
- **Verb-first narration** (الجملة الفعلية): «كانَتْ سارَةُ تُحِبُّ…», «فَاهْتَزَّتِ الأَشْجارُ».
  Link actions the Arabic way, with وَ / فَـ / ثُمَّ, rather than a row of short English-style sentences.
  The verb before its subject is singular and agrees in gender: «قالَتِ البومَةُ», «خَطَتِ السُّلَحْفاةُ».
- **Speech tags before the quote**: «قالَ الفيلُ: «…»». Put the tag after the quote only to carry a
  sentence over a page turn: «أَنْتِ قادِرَةٌ!» نادى… / …الأَسَدُ!
- **Full diacritics (تشكيل كامل) on the story text**, including case endings: Arabic children's books
  and books for learners are written fully vowelled, as a guide to pronunciation. Titles and the
  grown-up notes under the page can go without. Check every ending: diptotes (سارَةَ after a
  preposition, أَشْياءَ), the indefinite accusative (قَليلًا), the vowel that joins a word to
  the next (عَنِ الإِصْغاءِ، قالَتِ البومَةُ).
- **Idiomatic sound vocabulary**: حَفيفُ الأَوْراقِ (leaves), خَريرُ الماءِ / الجَدْوَلِ (a brook),
  زَقْزَقَةُ العَصافيرِ (birds), نَقيقُ الضَّفادِعِ (frogs), زَئيرُ الأَسَدِ (a roar). Sound words:
  *زَقْ زَقْ* (bird), *غَرررر!* (roar), *بُووو!* (elephant), *طِقْ طِقْ* / *بْلوبْ* (drops).
- **Punctuation**: Arabic comma ، semicolon ؛ and question mark ؟; speech in « » (usual in Maghreb
  and Levant publishing; keep one style per book); no space before ؟ or !. Digits: one style per
  book (Western 360 or Arabic-Indic ٣٦٠).
- **The cover** needs its title in Arabic too: re-letter it on the art
  (`books/sarra-and-the-little-lost-roar/make-cover-ar.py` shows how: lift the old title off the paper,
  letter the new one in the same ink with a real Arabic shaper) or ask ChatGPT to edit the cover.

## French

- « » with a non-breaking space inside, and before ? ! : ; (« Tu m’aides ? »).
- Dialogue tags usually after the quote, inverted: « Essaie ma voix ! » dit Éléphant.

## Delivering and checking

1. Write `books/<slug>/translations-<lang>.json`:
   `{ "language": "ar", "cover": "ar-page-01.jpg", "pages": [{ "title", "story", "note"? }, …] }`,
   one entry per page in reading order (notes are the grown-up comments shown under the page on a laptop).
2. Add it to the installed book: `npx tsx scripts/apply-translation.ts "<book title>" books/<slug>/translations-<lang>.json`
   (re-run after every correction), and copy each page's `title` and `story` into `pages.json` under
   `translations.<lang>` so a fresh install has it too.
3. Read the whole book in the reader in that language, on a phone and on a laptop, out loud once.
   If words crowd the picture in that language, set the page's **text size and position for that
   language** in Studio (Translations card) rather than shortening good text.
4. Have a native speaker read it before it is published.
