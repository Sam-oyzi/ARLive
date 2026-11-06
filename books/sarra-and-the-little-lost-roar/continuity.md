# Story order and visual continuity

This book has 20 story pages plus the cover. The app adds a separate back cover for printing.

## Reference and scale

The English cover and spread 01 establish Sarra’s curly brown bob, mustard pinafore, cream shirt and teal boots; the cub’s honey fur, small russet mane and teal scarf; the owl, elephant calf, brown rabbit and olive tortoise. Clothing and colors repeat. The tortoise is smaller than the cub, the rabbit’s head smaller than the cub’s head, and the elephant larger than Sarra when on the same ground plane. Apparent size can change with crouching or depth, not unexplained changes in proportions.

The path, brook, tree roots, cream paper, ink weight and palette carry through the book. The bridge stays a low rustic branch crossing a shallow brook. Framing stays at a coherent child’s-eye height; closer emotional compositions retain character proportions. Time moves from morning toward golden afternoon, sunset and bedtime.

## Final reading sequence

| Pages | Illustration | Narrative beat and continuity check |
|---|---|---|
| 1 | cover.png | Title and listening relationship; reference character designs. |
| 2–3 | spread-01.png | Garden hedge mystery, then reveal the cub. No bridge or recovered roar yet. |
| 4–5 | spread-02.png | Elephant’s loud attempt fails; small rabbit introduces listening. Oversized rabbit corrected. |
| 6–7 | spread-03.png | Try the bird’s voice, then acknowledge the cub’s own voice; same woodland path. |
| 8–9 | spread-04.png | Owl offers a gentle insight; the creek introduces a new small voice. |
| 10–11 | spread-05.png | Cub recognizes another small voice; friends follow footprints along the same creek. |
| 12–13 | spread-06.png | Reveal tortoise, then teamwork builds the branch bridge. Oversized foreground tortoise corrected. |
| 14–15 | spread-07.png | Tortoise hesitates on the completed bridge; cub chooses to stand beside him. Roar has not returned yet. |
| 16–17 | spread-08.png | Cub offers encouragement; page turn reveals his brave roar. Tortoise reaches safety. |
| 18–19 | spread-09.png | Tortoise thanks his friends; quiet reflection beside the same creek and bridge. |
| 20–21 | spread-10.png | Garden gate goodbye, then bed at home. Bedtime shirt corrected: pinafore removed and draped on bed, boots beside it. |

A line on page 14 was adjusted to match the illustration’s pause on the bridge rather than describing a fully withdrawn tortoise head. Every spread is paired left/right in pages.json, in this sequence. English and French follow the same beats.

## Story worlds

Five 4096 × 2048 renders replace the previous panorama art. They use the same level camera at 1.5 m above the bank. Page 3 opens the woodland path in Step Inside. Pages 8, 9, 17 and 19 open the owl grove, listening brook, branch bridge and evening river in the 360° viewer. The bridge and stream use the same geometry at the crossing on pages 17 and 19. The cub and tortoise reuse the book’s existing 3D models. The owl sits on a low branch above the horizon. Perspective proofs were checked ahead, right, behind, left, overhead and underfoot.

## Final verification

To rebuild the panoramas, run Blender with `--python render-worlds.py`. Run prepare-assets.mjs, then compile-targets.mjs, then verify-book.mjs before a fresh install. The compiler records hashes of the final page JPGs. For an installed copy with the eight AR targets already compiled, run `node books/sarra-and-the-little-lost-roar/install-book.mjs --update-worlds` from the repository root to replace only the world assets and page settings. Printed-page recognition and floor tracking still require an on-device proof.

## Completed production checks

- All ten final spreads were inspected against the 21-entry English/French manifest in reading order.
- Corrected rabbit size, tortoise size, bedtime clothing, and the later illustration/panorama's bridge design. Rechecked the selected corrected outputs; the branch bridge has no railings.
- Seven final targets compiled successfully, each with 65–78 tracking points and 2,924–3,376 matching points. Source hashes match the final page images.
- Original lion, tortoise and bird GLBs each contain an animation and pass structural loading checks.
- English and French PDFs each contain 21 pages; extracted story text matches every page with no missing lines. All 20 story-page illustrations are pixel-identical between language versions below the text bands. Rendered page overviews and individual pages were inspected.
- Local studio confirms Draft, 21 pages, seven AR pages and AR ready. Prepared artwork, models, panoramas and tracking data all return successful HTTP responses.
- Phone-width reader checked for page turns, story lettering and French language selection. Actual camera tracking and matte-paper proofs remain to be verified on a phone.
