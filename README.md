# Sketchling

A free library of illustrated stories for kids. Families read the books on a phone or a laptop,
download them as a PDF to print at home, and scan the pages marked AR with a phone to watch the
characters pop out in 3D. Parents can also ask for a **custom story** starring their child, built
around something they want the child to learn or think about (sharing, bedtime, being brave…).

Built on [MindAR](https://hiukim.github.io/mind-ar-js-doc/) image tracking. Runs in the browser, so
nobody installs an app.

## Features

**Library (public, `/`, `/library`, `/library/:bookId`)**
- Home page with featured, most-loved, top-rated and new books, and browsing by category
- Search, category filters and sorting (most popular, top rated, newest)
- Each book shows its star rating, downloads and likes; signed-in readers rate (1–5 stars) and like
- Read online (`/read/:bookId`), download / print (`/print/:bookId`) and scan AR pages
  (`/scan/:bookId`). Each book is readable by **everyone**, **any account**, or **approved emails only**;
  readers of a locked book ask for access from its page
- Reader: two-page spreads on a laptop; on a phone one full-screen page at a time with a page-curl
  turn (drag to peel a corner, tap the edges to turn, tap the middle for the controls), and
  **Read to me** when pages have a recorded voice
- The printed back cover carries a QR code that opens the book's AR scanner on a phone (set `SITE_URL`)
- Picture-book pages: on a phone and in print, each page's story is drawn onto the picture in the
  calmest part of the art (or where the admin puts it). Each line of the story is a line on the page,
  and `*Buzz buzz*` makes a big, colourful sound word. How to write books in this style:
  [.claude/skills/arlive-book/references/picture-book.md](.claude/skills/arlive-book/references/picture-book.md)

**Families (`/signup`, `/account`, `/stories`)**
- Free parent accounts: profile, children (first name, age, what they love) and liked books
- Custom story requests: who it's for, the lesson (from a list or "something else"), the parent's
  own words, the child's interests and the story language
- Request status and notes from the team; the finished story appears in the account, private to
  that family

**Admin studio (`/admin`)**
- Dashboard: library books, families, downloads, likes, AR scans and open story requests
- Story requests: start a draft book owned by the family, build it in the studio, then deliver it
  (publishes it for that family only)
- Books: upload page images, mark AR pages, compile them into a MindAR `.mind` file in the browser,
  publish, and feature on the home page; library stats per book
- Who can read each book, approved emails (e.g. buyers of the printed book) and a **Reader access**
  inbox for requests. Custom stories open only for approved emails; delivering one approves the family
- Voice narration per page (MP3, M4A, OGG or WAV), played in order by the reader's Read to me
- 3D scene editor per page: add GLB models (with animation clips), video, images, audio and text
  labels, then place them with move/rotate/scale gizmos
- Categories, users, and the school channel (schools, join codes, access requests)

**Schools (`/school`, `/learn`)**
- Still supported: school admins manage students and request books; students join with a code and
  read their school's books

## Stack

Next.js 16 (App Router, server actions, `proxy.ts`) · React 19 · TypeScript · Tailwind CSS 4 ·
Prisma (SQLite locally, PostgreSQL in production) · three.js + React Three Fiber · MindAR ·
Radix primitives · JWT sessions (jose) with bcrypt.

## Getting started

```bash
npm install
cp .env.example .env          # then set SESSION_SECRET to a long random string
npx prisma db push            # creates prisma/dev.db
npm run db:seed               # demo accounts, categories, sample books and a story request
npm run dev
```

Open http://localhost:3000 and sign in with a demo account (local development only):

| Role           | Username                | Password     |
| -------------- | ----------------------- | ------------ |
| Platform admin | `admin@arlive.app`      | `admin1234`  |
| Parent         | `parent@sketchling.app` | `parent1234` |
| School admin   | `school@arlive.app`     | `school1234` |
| Student        | `student`               | `student123` |

The demo school's join code is `DEMO2026`.

If the sample book shows **Not compiled**, open it under *Books & AR pages* and click **Compile**.

### Testing on a phone (laptop without a camera)

Browsers only open the camera over HTTPS, so start the dev server in phone mode:

```bash
npm run dev:phone
```

It serves the app twice and prints both addresses:

- `http://localhost:3000` for the laptop browser (and Claude's preview panel), no warning.
- `https://<your-wifi-ip>:3443` for phones on the same Wi-Fi. This uses a self-signed
  certificate (nothing is installed on your computer), so the phone shows a warning once.

Then:

1. On the laptop, open `http://localhost:3000` and sign in.
2. Open a book's scanner (`Test in AR` in the admin, or a subject page as a student). A
   **Continue on your phone** QR code appears.
3. Scan it with the phone (same Wi-Fi). Accept the certificate warning once
   (Chrome: *Advanced → Proceed*; Safari: *Show details → visit this website*). The phone is
   signed in as you for that page (the link expires after 5 minutes).
4. Tap **Start scanning** and point the phone at the target — printed, or just shown full screen
   on the laptop's monitor.

If the phone can't connect, allow Node.js through your computer's firewall on private networks.

### Checks

```bash
npm test             # unit tests (Node's built-in test runner)
npm run typecheck
```

CI runs these plus a production build on every push to `main` and every pull request.

## How AR content works

- Each **book** groups pages. All its pages compile into one `.mind` file, so a student can scan any
  page of the book and the right content appears.
- Compilation runs in the admin's browser (like MindAR Studio) and uploads the result. Adding,
  removing or replacing a page marks the book **Needs recompile**.
- Content transforms are stored in page space: 1 unit = page width, origin = page centre, +Z points
  out of the page. Models are auto-scaled so their largest side is 1 unit before your scale applies.
- Keep books under about 30 pages; split larger books into chapters for faster recognition.

## Project layout

```
prisma/              schema, seed, sample assets
scripts/             sample asset generator
src/ar/              AR session (camera + MindAR + three.js), content loaders, target compiler
src/app/admin        platform admin
src/app/school       school admin
src/app/learn        student app
src/app/scan         full-screen AR viewer
src/app/api          uploads, .mind upload, scan analytics
src/app/files        serves uploaded files (with range requests for video)
src/server/actions   server actions (all authorised server-side)
src/lib              auth, storage, shared helpers
```

## Making a book (read, AR, print)

The seed installs **"Example: The Journey of a Water Drop"** (Science & nature): a cover + 6 two-page
spreads in the sketchbook format, with three AR pages that already have 3D content (molecule model,
3D text with animations). Open it from *Books & AR pages → Preview book* to see the result before
making your own. Its pages are drawn by `scripts/make-example-book.ts`.

1. Plan it with Claude: ask for a book on any topic. The `arlive-book` skill
   (`.claude/skills/arlive-book`) writes `books/<slug>/plan.md`, copy-paste ChatGPT image prompts in
   `prompts.md`, and `pages.json` (titles, stories, which pages are AR).
2. Generate each picture in ChatGPT and save it with the file name from `prompts.md`.
3. In ARLive, create the book (pick its printed page size) and drop **all images and `pages.json`
   together**. Tick "two-page spreads" if the pictures are spreads; they're split into pages.
4. **Preview book** opens the flip-book reader: drag or click to turn pages, use the magnifier, and
   switch each page between *AR page* (compiled as a target) and *Story page* (reading and print only).
5. Place 3D content on the AR pages, **Compile**, **Publish**.
6. **Print** lays the pages out one per sheet at the real size. Use "Save as PDF" and send it to a
   print shop. AR pages can carry a small "scan this page" badge.

Students get a **Read the book** button next to **Start scanning**.

**3D models are optimised on upload.** AI generators (Hunyuan3D, Meshy, Tripo…) export
million-triangle models with 4K textures; every uploaded GLB is reduced to about 80k triangles with
1024 px WebP textures and meshopt-compressed geometry (e.g. a Hunyuan3D snowflake: 76.8 MB → 1.1 MB in
about 2 s). If optimising fails or doesn't help, the original file is kept. To optimise a file by
hand: `npm run optimize:glb -- model.glb`.

## Production notes

- Switch `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`.
- Uploads are written to `storage/uploads`; mount it on a persistent volume, or replace
  `src/lib/storage.ts` with S3/R2 (same function signatures).
- Set a strong `SESSION_SECRET`; cookies are `Secure` when `NODE_ENV=production`.
- Set `SITE_URL` to the public address (e.g. `https://sketchling.app`): it's printed into the QR code on
  every book's back cover. In development the QR uses this computer's Wi-Fi address instead.
- Never use the demo accounts: their passwords are public in this README, and `npm run db:seed` refuses to
  run when `NODE_ENV=production`. Create the first platform admin with
  `npm run admin:create -- you@example.com "Your Name"`, which prints a generated password once. Anyone
  can change their own password from their account menu, which signs out their other devices.
- Sign-in and join attempts are rate limited in memory (`src/lib/rate-limit.ts`). That covers one server
  process; with several instances, move the counters to Redis or the database.
