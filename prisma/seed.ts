// Demo data for local development. Safe to re-run.
//   Platform admin  admin@arlive.app      / admin1234
//   Parent          parent@sketchling.app / parent1234
//   School admin    school@arlive.app     / school1234
//   Student         student               / student123
//   School join code DEMO2026
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { targetsSignature } from "../src/lib/books";
import { averageStars } from "../src/lib/library";

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

/** Library categories. */
const SUBJECTS = [
  { name: "Science & nature", slug: "science-nature", icon: "droplets", color: "#0ea5e9", description: "How the world works, told as a story." },
  { name: "Bedtime stories", slug: "bedtime", icon: "moon", color: "#3b82f6", description: "Calm, cosy stories to end the day." },
  { name: "Animal friends", slug: "animals", icon: "paw", color: "#10b981", description: "Furry, feathery and scaly heroes." },
  { name: "Adventure", slug: "adventure", icon: "map", color: "#f97316", description: "Journeys, treasure maps and brave explorers." },
  { name: "Fairy tales", slug: "fairy-tales", icon: "castle", color: "#f43f5e", description: "Castles, dragons and a little magic." },
  { name: "Feelings & values", slug: "feelings", icon: "heart", color: "#ef4444", description: "Kindness, courage, sharing and big feelings." },
];

/** School subjects created by earlier versions of this seed; removed once they hold no books. */
const LEGACY_SUBJECTS = ["chemistry", "biology", "physics", "geography", "history", "mathematics"];

async function main() {
  // These passwords are public in the README. Use `npm run admin:create` for a real deployment.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to create demo accounts in production. Run `npm run admin:create -- you@example.com` instead.");
  }

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
    create: { name: "Demo High School", slug: "demo-high-school", city: "Demo City", joinCode: "DEMO2026", color: "#f26a1a", maxStudents: 500 },
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

  const science = subjects[0]!;
  const example = await seedExampleBook(science.id);
  if (example) {
    await db.schoolBook.upsert({
      where: { schoolId_bookId: { schoolId: school.id, bookId: example.id } },
      update: {},
      create: { schoolId: school.id, bookId: example.id },
    });
  }

  // Demo books seeded into the old school subjects move to the story categories.
  const legacy = await db.subject.findMany({ where: { slug: { in: LEGACY_SUBJECTS } }, select: { id: true } });
  if (legacy.length > 0) {
    await db.book.updateMany({
      where: { subjectId: { in: legacy.map((s) => s.id) }, title: EXAMPLE_TITLE },
      data: { subjectId: science.id },
    });
    await db.subject.deleteMany({ where: { id: { in: legacy.map((s) => s.id) }, books: { none: {} } } });
  }

  await seedFamily(example?.id);

  console.log("Seeded. Sign in as admin@arlive.app / admin1234 or parent@sketchling.app / parent1234");
}

/** A demo parent with a child, a waiting custom story request, and a rating and like on the example book. */
async function seedFamily(bookId: string | undefined) {
  const parent = await db.user.upsert({
    where: { username: "parent@sketchling.app" },
    update: {},
    create: { name: "Sara Parent", username: "parent@sketchling.app", role: "PARENT", passwordHash: await bcrypt.hash("parent1234", 10) },
  });
  let child = await db.child.findFirst({ where: { parentId: parent.id } });
  child ??= await db.child.create({ data: { parentId: parent.id, name: "Lina", age: 5, interests: "cats, the sea, drawing" } });
  if ((await db.storyRequest.count({ where: { userId: parent.id } })) === 0) {
    await db.storyRequest.create({
      data: {
        userId: parent.id,
        childId: child.id,
        childName: child.name,
        childAge: child.age,
        interests: child.interests,
        goal: "kindness",
        message: "Lina finds it hard to share her crayons with her little brother. I'd love a story that shows sharing can be fun and makes everyone happier.",
        language: "en",
      },
    });
  }
  if (!bookId) return;
  await db.bookLike.upsert({ where: { userId_bookId: { userId: parent.id, bookId } }, update: {}, create: { userId: parent.id, bookId } });
  await db.bookRating.upsert({ where: { userId_bookId: { userId: parent.id, bookId } }, update: {}, create: { userId: parent.id, bookId, stars: 5 } });
  // Keep the library counters in step with the rows (as src/server/actions/library.ts does), and
  // feature the example on the home page.
  const [likes, ratings] = await Promise.all([db.bookLike.count({ where: { bookId } }), db.bookRating.findMany({ where: { bookId }, select: { stars: true } })]);
  await db.book.update({
    where: { id: bookId },
    data: {
      likeCount: likes,
      ratingCount: ratings.length,
      ratingAvg: averageStars(ratings.map((r) => r.stars)),
      featured: true,
    },
  });
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
    pages: { file: string; title: string; story: string; ar: boolean; textPosition?: string; translations?: Prisma.InputJsonObject }[];
  };

  const book = await db.book.create({
    data: {
      title: EXAMPLE_TITLE,
      description: "Follow Lou the water drop from the sea to the clouds and back again: a sketchbook story about the water cycle, with three pages that pop out in 3D.",
      gradeLevel: "Ages 6–10",
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
      data: { bookId: book.id, name: page.title, description: page.story, translations: page.translations, imageUrl, width: 768, height: 1024, order, ar: page.ar, textPosition: page.textPosition },
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
