// Demo data for local development. Safe to re-run.
//   Platform admin  admin@arlive.app   / admin1234
//   School admin    school@arlive.app  / school1234
//   Student         student            / student123
//   School join code DEMO2026
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
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

  console.log("Seeded. Sign in as admin@arlive.app / admin1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
