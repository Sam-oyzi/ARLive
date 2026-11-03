# ARLive

Augmented reality for every classroom. Students pick a subject, point their phone at a page of their
textbook, and the page comes alive with 3D models, animations, video, audio and labels. A platform
admin builds the AR content and decides which schools get which books; school admins manage their
students.

Built on [MindAR](https://hiukim.github.io/mind-ar-js-doc/) image tracking. Runs in the browser, so
nobody installs an app.

## Features

**Platform admin (`/admin`)**
- Subjects (matières) with icons and colours
- Books: upload page images as targets, then compile them into a MindAR `.mind` file in the browser
- 3D scene editor per page: add GLB models (with animation clips), video, images, audio and text
  labels, then place them with move/rotate/scale gizmos
- Schools: seats, join code, per-book or per-subject access, school admins
- Access requests from schools, users, and usage analytics

**School admin (`/school`)**
- Overview with scans per day and most active students
- Students: paste a class list to create accounts, print login slips, reset passwords
- Join code + QR so students can sign up on their own
- Catalog: request more books from the platform

**Student (`/learn`, `/scan/:bookId`)**
- Subject grid → subject page with a phone mockup and the books available to their school
- Full-screen AR scanner: scanning guide, info card for the recognised page, replay, mute,
  drag to spin, pinch to zoom, take and share a photo
- Installable as an app (web manifest)

## Stack

Next.js 16 (App Router, server actions, `proxy.ts`) · React 19 · TypeScript · Tailwind CSS 4 ·
Prisma (SQLite locally, PostgreSQL in production) · three.js + React Three Fiber · MindAR ·
Radix primitives · JWT sessions (jose) with bcrypt.

## Getting started

```bash
npm install
cp .env.example .env          # then set SESSION_SECRET to a long random string
npx prisma db push            # creates prisma/dev.db
npm run db:seed               # demo school, users, subjects and a sample book
npm run dev
```

Open http://localhost:3000 and sign in with a demo account (local development only):

| Role           | Username            | Password     |
| -------------- | ------------------- | ------------ |
| Platform admin | `admin@arlive.app`  | `admin1234`  |
| School admin   | `school@arlive.app` | `school1234` |
| Student        | `student`           | `student123` |

The demo school's join code is `DEMO2026`.

If the sample book shows **Not compiled**, open it under *Books & targets* and click **Compile**.

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

If the phone can't connect, allow Node.js through the Windows firewall on private networks.

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

The seed installs **"Example: The Journey of a Water Drop"** (Chemistry): a cover + 6 two-page
spreads in the sketchbook format, with three AR pages that already have 3D content (molecule model,
3D text with animations). Open it from *Books & targets → Preview book* to see the result before
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
