<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Picture-book creation

Use the ARLive book skill for new stories. Default to at least 20 story pages plus a cover (10 spreads + cover = 21 pages), unless the user explicitly requests a shorter format. After generating images, check story order, character proportions, relative object sizes, wardrobe, and continuity of framing before import and AR compilation. See `.agents/skills/arlive-book/SKILL.md`.

## Reader and AR experiences

Each page has exactly one Studio-selected experience shared by the reader and printed-target scanner: `ar` (MindAR content anchored to the printed page), `quicklook` (automatically launch the first usable 3D layer in Apple AR Quick Look), `eighthwall` (automatically place that model with 8th Wall room tracking), `world` (automatically enter the tracked story box), or `panorama` (explicit 360° view). Keep all five choices in the Page experience dropdown on page cards and in the editor. Quick Look and 8th Wall use the first usable MODEL or TEXT3D layer in saved layer order. Recognition launches the saved engine without an engine/object picker; prepare USDZ while scanning. Native camera/motion/Quick Look permission or confirmation prompts may still be required by the device. Never silently fall back to another engine or from the story box to 360°, including on errors or unsupported devices. Show one experience action on the reading page; keep target editing controls and engine previews in Studio.
