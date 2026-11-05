// Gives the two sample books their 360° worlds, layered sounds and a read-aloud voice, for testing
// every page experience with sound. Safe to re-run (after `npm run db:seed` or the Sarra installer).
//   npx tsx scripts/attach-story-media.ts
// The voices are macOS text-to-speech (`say`), one per page, made once and kept in
// public/book-art/<book>/voice: placeholders until real recordings are uploaded in Studio.
// Worlds come from scripts/make-world-panoramas.py, sounds from scripts/make-nature-sounds.py.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/** A layer of the page's mix: a file in the book's sounds folder. Loops unless `once`. */
type Sound = { file: string; name: string; volume: number; delay?: number; once?: boolean };

type PageMedia = {
  world?: string;
  effect?: "none" | "rain" | "snow";
  scanAction?: "ar" | "world" | "panorama";
  /** Replaces the sounds of the page's experience (at most four). */
  sounds?: Sound[];
  /** Replaces the reader's soundtrack from this page on (at most two). */
  soundtrack?: Sound[];
  /** Under the page in the laptop reader. */
  note?: string;
};

const music: Sound = { file: "storytime.m4a", name: "Storytime music", volume: 0.4 };

const wind: Sound = { file: "mountain-wind.m4a", name: "Mountain wind", volume: 0.8 };
const owl: Sound = { file: "owl.m4a", name: "Owl", volume: 0.55, once: true };

const BOOKS: { title: string; folder: string; pages: Record<number, PageMedia> }[] = [
  {
    title: "Example: The Journey of a Water Drop",
    folder: "water-drop",
    // Keys are page numbers as printed (1 = the cover).
    pages: {
      1: { soundtrack: [music] },
      2: { sounds: [{ file: "waves.m4a", name: "Waves", volume: 0.8 }, { file: "rain.m4a", name: "Rain", volume: 0.45 }] },
      5: { sounds: [{ file: "waves.m4a", name: "Waves", volume: 0.8 }, { file: "rain.m4a", name: "Rain", volume: 0.45 }] },
      6: { sounds: [{ ...wind, volume: 0.6 }] },
      7: {
        world: "world-snowy-peaks.jpg", effect: "snow", scanAction: "panorama",
        sounds: [wind, { file: "songbirds.m4a", name: "A bird far below", volume: 0.2, delay: 5 }],
      },
      12: {
        world: "world-river.jpg", effect: "none", scanAction: "world",
        sounds: [
          { file: "stream.m4a", name: "Stream", volume: 0.8 },
          { file: "songbirds.m4a", name: "Birds", volume: 0.5 },
          { file: "cuckoo.m4a", name: "Cuckoo", volume: 0.3, delay: 6 },
        ],
      },
    },
  },
  {
    title: "Sarra and the Little Lost Roar",
    folder: "sarra-and-the-little-lost-roar",
    pages: {
      1: { soundtrack: [music] },
      4: { note: "Talk about it: when is a quiet voice better than a loud one?" },
      12: { note: "Did you know? A tortoise can live for more than 100 years." },
      17: { note: "Talk about it: what does a brave voice sound like?", sounds: eveningRiver() },
      3: {
        sounds: [
          { file: "leaves.m4a", name: "Leaves in the breeze", volume: 0.5 },
          { file: "songbirds.m4a", name: "Birds", volume: 0.7 },
          { file: "cuckoo.m4a", name: "Cuckoo", volume: 0.35, delay: 4 },
          { ...owl, delay: 9 },
        ],
      },
      6: { sounds: [{ file: "songbirds.m4a", name: "Birds", volume: 0.8 }, { file: "leaves.m4a", name: "Leaves", volume: 0.35 }] },
      9: {
        world: "world-brook.jpg", effect: "none", scanAction: "panorama",
        note: "Listen together: close your eyes. What sounds can you hear right now?",
        // By the water from here to the crossing: the brook joins the music.
        soundtrack: [music, { file: "brook.m4a", name: "Brook", volume: 0.22 }],
        sounds: [
          { file: "brook.m4a", name: "Brook (plip, plop)", volume: 0.8 },
          { file: "songbirds.m4a", name: "Birds", volume: 0.45 },
          { file: "frogs.m4a", name: "Frogs", volume: 0.5, delay: 2 },
        ],
      },
      19: { sounds: eveningRiver() },
      20: { soundtrack: [music] },
    },
  },
];

function eveningRiver(): Sound[] {
  return [
    { file: "brook.m4a", name: "River", volume: 0.7 },
    { file: "crickets.m4a", name: "Crickets", volume: 0.45 },
    { file: "frogs.m4a", name: "Frogs", volume: 0.4 },
    { ...owl, delay: 6 },
  ];
}

const VOICE = "Samantha";

/** The story as it should be read: no emphasis marks, a breath between lines. */
function spoken(text: string) {
  return text
    .replace(/[*_]/g, "")
    .replace(/\n\s*\n/g, " [[slnc 600]] ")
    .replace(/\n/g, " [[slnc 300]] ")
    .trim();
}

function narrate(text: string, out: string) {
  const aiff = path.join(os.tmpdir(), `${path.basename(out, ".m4a")}-${process.pid}.aiff`);
  execFileSync("say", ["-v", VOICE, "-r", "160", "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", "-c", "1", aiff, out]);
  fs.rmSync(aiff, { force: true });
}

async function main() {
  const db = new PrismaClient();
  try {
    for (const spec of BOOKS) {
      const book = await db.book.findFirst({ where: { title: spec.title }, include: { targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } } });
      if (!book) {
        console.log(`Skipped "${spec.title}": not installed.`);
        continue;
      }
      const publicDir = path.join(process.cwd(), "public", "book-art", spec.folder);
      const url = (...parts: string[]) => `/book-art/${[spec.folder, ...parts].join("/")}`;
      fs.mkdirSync(path.join(publicDir, "voice"), { recursive: true });

      let voices = 0;
      let arAdded = false;
      for (const [index, page] of book.targets.entries()) {
        const number = index + 1;
        const text = index === 0 ? book.title.replace(/^Example:\s*/, "") : page.description;
        const media = spec.pages[number] ?? {};
        for (const file of [media.world, ...[...(media.sounds ?? []), ...(media.soundtrack ?? [])].map((sound) => `sounds/${sound.file}`)].filter(Boolean) as string[]) {
          if (!fs.existsSync(path.join(publicDir, file))) throw new Error(`Missing ${path.join(publicDir, file)}: make it first (see the header).`);
        }

        let narrationUrl = page.narrationUrl;
        if (text?.trim() && !narrationUrl) {
          const file = `page-${String(number).padStart(2, "0")}.m4a`;
          if (!fs.existsSync(path.join(publicDir, "voice", file))) narrate(spoken(text), path.join(publicDir, "voice", file));
          narrationUrl = url("voice", file);
          voices++;
        }
        // A page with a world needs to be a scan target too, so its printed page opens it.
        const becomesAr = !!media.world && !page.ar;
        arAdded ||= becomesAr;
        await db.target.update({
          where: { id: page.id },
          data: {
            narrationUrl,
            ...(media.world && { worldUrl: url(media.world), worldEffect: media.effect ?? "none", scanAction: media.scanAction ?? "panorama" }),
            ...(becomesAr && { ar: true }),
            ...(media.note && { note: media.note }),
          },
        });
        for (const [kind, list, limit] of [["scene", media.sounds, 4], ["reading", media.soundtrack, 2]] as const) {
          if (!list) continue;
          await db.pageSound.deleteMany({ where: { targetId: page.id, kind } });
          await db.pageSound.createMany({
            data: list.slice(0, limit).map((sound, order) => ({
              targetId: page.id, kind, name: sound.name, url: url("sounds", sound.file), volume: sound.volume, loop: !sound.once, delay: sound.delay ?? 0, order,
            })),
          });
        }
      }
      console.log(`${book.title}: ${voices} new voice(s), worlds and sounds attached.${arAdded ? " New AR pages: open the book in Studio and click Recompile." : ""}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
