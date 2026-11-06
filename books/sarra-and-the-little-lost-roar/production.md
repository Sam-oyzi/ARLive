# Reproduce the book

Source art was generated with the built-in image tool, using the prompt set in prompts.md and reference characters on the cover. All final source art, edited variants selected for the book, original model source, page text and French translations are stored in this folder.

From the repository root:

```sh
python3 books/sarra-and-the-little-lost-roar/write-book.py
python3 books/sarra-and-the-little-lost-roar/write-prompts.py
node books/sarra-and-the-little-lost-roar/make-models.mjs
node books/sarra-and-the-little-lost-roar/prepare-assets.mjs
node books/sarra-and-the-little-lost-roar/compile-targets.mjs
node books/sarra-and-the-little-lost-roar/verify-book.mjs
node books/sarra-and-the-little-lost-roar/install-book.mjs
```

The installer creates one new unpublished draft in the local Animal friends category. It copies prepared assets to public/book-art/sarra-and-the-little-lost-roar, writes the installed ID and preview URLs to installed.json, and refuses duplicate installation. It does not reset the database, create accounts, change another book or publish this child’s story. Edit the installed book in the admin studio thereafter.

The source manifest can also be imported with cover.png and spread-01.png through spread-10.png, with two-page spreads enabled and Sketchbook 3:4 selected. Use experience.json for the eight AR scenes and five rendered story worlds.

English and French family reading PDFs are in output/pdf/sarra-and-the-little-lost-roar-en.pdf and output/pdf/sarra-and-the-little-lost-roar-fr.pdf. They embed Gelasio 500 and Fredoka 700 from the app’s font assets. Regenerate them with make-pdfs.py using the bundled Python runtime with reportlab, fonttools and brotli available. They deliberately omit draft-only scanner links; print a scannable copy from the app’s Print page after the book’s access and hosting are ready.

Live installation: Sarra is now published as a public library book. The installer still creates new books as drafts; manage publication in Studio. The existing Water Drop QR codes link to Water Drop, not the library or Sarra. The current shared development site is https://dir-peace-hear-lets.trycloudflare.com (available while its local tunnel runs). Sarra’s reader is /read/cmw413bil0001q68164u1b98u on that host.

Page experiences are selected individually in Studio: `ar` scans printed-page content, `world` opens the tracked story box automatically around the reader, and `panorama` explicitly opens the 360° view. Both the digital reader and printed target use this choice. Camera errors never fall back to 360°.
