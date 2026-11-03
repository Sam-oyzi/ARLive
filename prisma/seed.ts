// Demo data for local development. Safe to re-run.
//   Platform admin  admin@arlive.app   / admin1234
//   School admin    school@arlive.app  / school1234
//   Student         student            / student123
//   School join code DEMO2026
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { targetsSignature } from "../src/lib/books";

const db = new PrismaClient();
const SAMPLE = path.join(__dirname, "sample");
const UPLOADS = path.join(process.cwd(), "storage", "uploads");

/** Copy a sample file into uploads under a fixed name and return its /files URL. */
function install(file: string, kind: string, name: string) {
  const source = path.join(SAMPLE, file);
  if (!fs.existsSync(source)) return null;
  fs.mkdirSync(path.join(UPLOADS, kind), { recursive: true });
  fs.copyFileSync(source, path.join(UPLOADS, kind, name));
  return `/files/${kind}/${name}`;
}

const SUBJECTS = [
  { name: "Chemistry", slug: "chemistry", icon: "flask", color: "#8b5cf6", description: "Atoms, molecules and reactions you can walk around." },
  { name: "Biology", slug: "biology", icon: "dna", color: "#10b981", description: "Cells, organs and living systems in 3D." },
  { name: "Physics", slug: "physics", icon: "atom", color: "#3b82f6", description: "Forces, waves and energy made visible." },
  { name: "Geography", slug: "geography", icon: "earth", color: "#0ea5e9", description: "Landforms, volcanoes and the planet up close." },
  { name: "History", slug: "history", icon: "landmark", color: "#f59e0b", description: "Monuments and artefacts rebuilt on your desk." },
  { name: "Mathematics", slug: "mathematics", icon: "sigma", color: "#ec4899", description: "Solids, graphs and geometry you can turn around." },
];

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);

  await db.user.upsert({
    where: { username: "admin@arlive.app" },
    update: {},
    create: { name: "Platform Admin", username: "admin@arlive.app", role: "SUPER_ADMIN", passwordHash: await hash("admin1234") },
  });

  const subjects = [];
  for (const [order, s] of SUBJECTS.entries()) {
    subjects.push(await db.subject.upsert({ where: { slug: s.slug }, update: {}, create: { ...s, order } }));
  }

  const school = await db.school.upsert({
    where: { slug: "demo-high-school" },
    update: {},
    create: { name: "Demo High School", slug: "demo-high-school", city: "Demo City", joinCode: "DEMO2026", color: "#5b5bf6", maxStudents: 500 },
  });

  await db.user.upsert({
    where: { username: "school@arlive.app" },
    update: {},
    create: { name: "Nadia Admin", username: "school@arlive.app", role: "SCHOOL_ADMIN", schoolId: school.id, passwordHash: await hash("school1234") },
  });
  await db.user.upsert({
    where: { username: "student" },
    update: {},
    create: { name: "Sami Student", username: "student", role: "STUDENT", grade: "Grade 10 — B", schoolId: school.id, passwordHash: await hash("student123") },
  });

  // Demo book: one page with an animated water molecule, compiled if the sample .mind exists.
  const chemistry = subjects[0]!;
  let book = await db.book.findFirst({ where: { title: "Discovering Molecules", subjectId: chemistry.id } });
  if (!book) {
    const imageUrl = install("water-page.png", "targets", "demowaterpage.png");
    const modelUrl = install("water.glb", "models", "demowatermolecule.glb");
    if (!imageUrl || !modelUrl) {
      console.warn("Sample assets missing — run `npx tsx scripts/make-sample-assets.ts` first. Skipping demo book.");
    } else {
      book = await db.book.create({
        data: {
          title: "Discovering Molecules",
          description: "Your first AR chemistry book: scan the page to meet the water molecule.",
          gradeLevel: "Grade 10",
          subjectId: chemistry.id,
        },
      });
      const target = await db.target.create({
        data: {
          bookId: book.id,
          name: "The water molecule",
          description:
            "Water (H₂O) is one oxygen atom bonded to two hydrogen atoms at an angle of 104.5°. That bent shape makes water polar, which is why it dissolves so many substances.",
          imageUrl,
          width: 800,
          height: 1100,
          order: 0,
        },
      });
      await db.content.createMany({
        data: [
          { targetId: target.id, type: "MODEL", name: "Water molecule", url: modelUrl, posX: 0, posY: 0.05, posZ: 0, rotX: 90, scale: 0.55, order: 0 },
          {
            targetId: target.id,
            type: "TEXT",
            name: "Label",
            text: "H₂O — bond angle 104.5°",
            color: "#ffffff",
            posX: 0,
            posY: -0.5,
            posZ: 0.02,
            scale: 0.6,
            order: 1,
          },
        ],
      });

      const mindUrl = install("water.mind", "mind", "demowater.mind");
      if (mindUrl) {
        await db.target.update({ where: { id: target.id }, data: { targetIndex: 0 } });
        await db.book.update({
          where: { id: book.id },
          data: { mindUrl, mindHash: targetsSignature([target]), compiledAt: new Date(), published: true },
        });
      } else {
        console.log("No prisma/sample/water.mind yet — open the book in /admin/books and click Compile.");
      }
    }
  }

  if (book) {
    await db.schoolBook.upsert({
      where: { schoolId_bookId: { schoolId: school.id, bookId: book.id } },
      update: {},
      create: { schoolId: school.id, bookId: book.id },
    });
  }

  const example = await seedExampleBook(chemistry.id);
  if (example) {
    await db.schoolBook.upsert({
      where: { schoolId_bookId: { schoolId: school.id, bookId: example.id } },
      update: {},
      create: { schoolId: school.id, bookId: example.id },
    });
  }

  console.log("Seeded. Sign in as admin@arlive.app / admin1234");
}

/**
 * "The Journey of a Water Drop": a cover + 6 spreads in the sketchbook format (pages drawn by
 * scripts/make-example-book.ts), to preview the reader, AR pages and print before making your own.
 */
const EXAMPLE_TITLE = "Example: The Journey of a Water Drop";

async function seedExampleBook(subjectId: string) {
  const existing = await db.book.findFirst({ where: { title: EXAMPLE_TITLE } });
  if (existing) return existing;
  const dir = path.join(SAMPLE, "example-book");
  if (!fs.existsSync(path.join(dir, "pages.json"))) {
    console.warn("No example book assets — run `npx tsx scripts/make-example-book.ts`.");
    return null;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "pages.json"), "utf8")) as {
    pages: { file: string; title: string; story: string; ar: boolean; translations?: Prisma.InputJsonObject }[];
  };

  const book = await db.book.create({
    data: {
      title: EXAMPLE_TITLE,
      description: "A water-cycle sketchbook: cover + 6 two-page spreads with three AR pages. Use it to try the reader, AR and print.",
      gradeLevel: "Ages 10–12",
      format: "SKETCH",
      subjectId,
    },
  });

  const molecule = install("water.glb", "models", "examplewatermolecule.glb");
  // 3D content for the AR pages (by file name).
  const keyed = (motion: object) => JSON.stringify(motion);
  const CONTENT: Record<string, Omit<Prisma.ContentUncheckedCreateInput, "targetId">[]> = {
    "page-05.jpg": [
      ...(molecule ? [{ type: "MODEL", name: "Water molecule", url: molecule, posY: 0.12, rotX: 90, scale: 0.6, order: 0 }] : []),
      { type: "TEXT3D", name: "H2O", text: "H2O", color: "#c8433a", posY: -0.42, rotX: 90, scale: 1.3, motion: keyed({ kind: "preset", preset: "float", speed: 1 }), order: 1 },
    ],
    "page-06.jpg": [
      { type: "TEXT3D", name: "ICE", text: "ICE", color: "#0ea5e9", posY: 0, rotX: 90, scale: 1.8, motion: keyed({ kind: "preset", preset: "spin", speed: 1 }), order: 0 },
      { type: "TEXT", name: "Label", text: "Six arms: water freezes in hexagons", color: "#ffffff", posY: -0.5, posZ: 0.02, scale: 0.7, order: 1 },
    ],
    "page-11.jpg": [
      { type: "TEXT3D", name: "RAIN", text: "RAIN", color: "#34497a", posY: 0.05, rotX: 90, scale: 1.5, motion: keyed({ kind: "preset", preset: "bounce", speed: 1 }), order: 0 },
    ],
  };

  const arTargets: { id: string; imageUrl: string }[] = [];
  for (const [order, page] of manifest.pages.entries()) {
    const imageUrl = install(path.join("example-book", page.file), "targets", `example${page.file.replace(/[^a-z0-9.]/gi, "")}`);
    if (!imageUrl) continue;
    const target = await db.target.create({
      data: { bookId: book.id, name: page.title, description: page.story, translations: page.translations, imageUrl, width: 768, height: 1024, order, ar: page.ar },
    });
    for (const content of CONTENT[page.file] ?? []) await db.content.create({ data: { ...content, targetId: target.id } });
    if (page.ar) arTargets.push(target);
  }

  // Ready to scan if the compiled AR data for these pages ships with the sample.
  const mindUrl = install(path.join("example-book", "example.mind"), "mind", "example.mind");
  if (mindUrl) {
    for (const [index, target] of arTargets.entries()) await db.target.update({ where: { id: target.id }, data: { targetIndex: index } });
    await db.book.update({
      where: { id: book.id },
      data: { mindUrl, mindHash: targetsSignature(arTargets), compiledAt: new Date(), published: true },
    });
  } else {
    console.log("Example book: open it in /admin/books and click Compile to enable AR.");
  }
  return book;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
