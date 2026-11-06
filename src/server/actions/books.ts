"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { CONTENT_META, CONTENT_TYPES, defaultTransform, type ContentData } from "@/lib/content";
import { parseMotion } from "@/lib/motion-schema";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { TEXT_POSITION_KEYS } from "@/lib/story-text";
import { SCAN_ACTIONS, placementModel, opensModel } from "@/lib/scan-actions";
import { WORLD_EFFECT_LABEL, WORLD_EFFECTS, type WorldEffect } from "@/lib/world-effects";
import { BOOK_FORMATS, type BookFormat } from "@/lib/book-format";
import { DEFAULT_BOOK_AUTHOR, defaultBookQuote } from "@/lib/book-credits";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/storage";
import { canPublish, compileState } from "@/lib/books";
import { pageSoundRow, SOUND_LIMIT, soundKindOf, type PageSoundRow, type SoundKind } from "@/lib/sound-layers";
import { checkbox, failure, invalid, parseForm, refreshAll, type ActionState } from "../forms";

const bookSchema = z.object({
  id: z.string().optional(),
  title: z.string({ error: "Enter a title" }).min(2).max(140),
  description: z.string().max(600).optional(),
  gradeLevel: z.string().max(60).optional(),
  subjectId: z.string({ error: "Pick a category" }),
  coverUrl: z.union([z.string().startsWith("/files/"), z.string().startsWith("/book-art/")]).optional(),
  authorName: z.string().min(1).max(120).optional(),
  copyrightYear: z.coerce.number().int().min(1900).max(2100).optional(),
  bookQuote: z.string().min(1).max(360).optional(),
  format: z.enum(Object.keys(BOOK_FORMATS) as [BookFormat, ...BookFormat[]]).default("A5"),
  featured: checkbox,
});

export async function saveBook(_prev: ActionState<{ id: string }>, formData: FormData): Promise<ActionState<{ id: string }>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(bookSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    const fields = { ...data, coverUrl: data.coverUrl ?? null };
    if (id) {
      const previous = await db.book.findUniqueOrThrow({ where: { id } });
      await db.book.update({ where: { id }, data: { ...fields, authorName: data.authorName ?? previous.authorName, copyrightYear: data.copyrightYear ?? previous.copyrightYear, bookQuote: data.bookQuote ?? previous.bookQuote ?? defaultBookQuote(data.title) } });
      if (previous.coverUrl && previous.coverUrl !== fields.coverUrl) await deleteUpload(previous.coverUrl);
      refreshAll();
      return { ok: true, message: "Book updated", data: { id } };
    }
    const book = await db.book.create({ data: { ...fields, authorName: data.authorName ?? DEFAULT_BOOK_AUTHOR, copyrightYear: data.copyrightYear ?? new Date().getUTCFullYear(), bookQuote: data.bookQuote ?? defaultBookQuote(data.title) } });
    refreshAll();
    return { ok: true, message: "Book created", data: { id: book.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function setBookPublished(bookId: string, published: boolean): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const book = await db.book.findUniqueOrThrow({ where: { id: bookId }, include: { targets: { select: { id: true, imageUrl: true, ar: true } } } });
    if (published && book.targets.length === 0) return { error: "Add the book's pages before publishing." };
    if (published && !canPublish(compileState(book, book.targets), book.targets.length)) {
      return { error: "Compile the AR pages (or turn them into story pages) before publishing." };
    }
    await db.book.update({ where: { id: bookId }, data: { published } });
    refreshAll();
    const audience = book.ownerId ? "the family can read it now" : "it's in the library for everyone";
    return { ok: true, message: published ? `Published: ${audience}` : "Moved back to draft" };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBook(bookId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const book = await db.book.findUniqueOrThrow({
      where: { id: bookId },
      include: { targets: { include: { contents: true, sounds: true } } },
    });
    await db.book.delete({ where: { id: bookId } });
    const urls = [book.coverUrl, book.mindUrl, ...book.targets.flatMap((t) => [t.imageUrl, t.narrationUrl, t.worldUrl, ...t.contents.map((c) => c.url), ...t.sounds.map((s) => s.url)])];
    await Promise.all(urls.map((url) => deleteUpload(url)));
    refreshAll();
    return { ok: true, message: "Book deleted" };
  } catch (error) {
    return failure(error);
  }
}

// ---------- Targets (pages) ----------

const newTargets = z.array(
  z.object({
    name: z.string().min(1).max(120),
    imageUrl: z.string().startsWith("/files/targets/"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    // From an imported pages.json: the page story and whether it is an AR page.
    description: z.string().max(1000).nullish(),
    translations: pageTranslationsSchema.optional(),
    ar: z.boolean().optional(),
    textPosition: z.enum(TEXT_POSITION_KEYS).optional(),
  }),
);

export async function addTargets(bookId: string, items: z.input<typeof newTargets>): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = newTargets.safeParse(items);
    if (!parsed.success) return invalid(parsed.error);
    const last = await db.target.findFirst({ where: { bookId }, orderBy: { order: "desc" } });
    let order = (last?.order ?? -1) + 1;
    await db.target.createMany({ data: parsed.data.map((t) => ({ ...t, bookId, order: order++ })) });
    refreshAll();
    return { ok: true, message: `${parsed.data.length} page(s) added` };
  } catch (error) {
    return failure(error);
  }
}

const targetSchema = z.object({
  id: z.string(),
  name: z.string({ error: "Enter a name" }).min(1).max(120),
  description: z.string().max(1000).optional(),
  textPosition: z.enum(TEXT_POSITION_KEYS).default("auto"),
  note: z.string().max(600).optional(),
});

export async function updateTarget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(targetSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, name, description, textPosition, note } = parsed.data;
    await db.target.update({ where: { id }, data: { name, description: description ?? null, textPosition, note: note ?? null } });
    refreshAll();
    return { ok: true, message: "Page details saved" };
  } catch (error) {
    return failure(error);
  }
}

/** Choose whether a page is compiled as an AR target or is a story page (reader and print only). */
export async function setTargetAr(targetId: string, ar: boolean): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    await db.target.update({ where: { id: targetId }, data: { ar } });
    refreshAll();
    return { ok: true, message: ar ? "AR page — recompile the book to apply" : "Story page — recompile the book to apply" };
  } catch (error) {
    return failure(error);
  }
}

/** Swap the image of a page (e.g. a better scan). The book will need recompiling. */
export async function replaceTargetImage(
  targetId: string,
  image: { imageUrl: string; width: number; height: number },
): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (!image.imageUrl.startsWith("/files/targets/")) return { error: "Invalid image" };
    const previous = await db.target.findUniqueOrThrow({ where: { id: targetId } });
    await db.target.update({ where: { id: targetId }, data: image });
    await deleteUpload(previous.imageUrl);
    refreshAll();
    return { ok: true, message: "Image replaced — recompile the book to apply it" };
  } catch (error) {
    return failure(error);
  }
}

const translationInput = z.object({
  locale: z.enum(["fr", "ar", "es", "de"]),
  title: z.string().trim().max(120),
  story: z.string().trim().max(1000),
  note: z.string().trim().max(600).default(""),
});

/** Saves (or, with an empty title, removes) one language's title, story and note for a page. */
export async function savePageTranslation(targetId: string, input: z.input<typeof translationInput>): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = translationInput.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { locale, title, story, note } = parsed.data;
    const target = await db.target.findUniqueOrThrow({ where: { id: targetId } });
    const current = pageTranslationsSchema.safeParse(target.translations).data ?? {};
    const next = { ...current };
    if (title) next[locale] = { ...current[locale], title, story: story || undefined, note: note || undefined };
    else delete next[locale];
    const checked = pageTranslationsSchema.safeParse(next);
    if (!checked.success) return invalid(checked.error);
    await db.target.update({ where: { id: targetId }, data: { translations: Object.keys(checked.data).length ? checked.data : Prisma.DbNull } });
    refreshAll();
    return { ok: true, message: title ? "Translation saved" : "Translation removed" };
  } catch (error) {
    return failure(error);
  }
}

/** The 360° story world readers can step into from this page; null removes it. */
export async function setPageWorld(targetId: string, url: string | null): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (url !== null && !url.startsWith("/files/worlds/")) return { error: "Upload a 360° panorama (JPG, PNG or WebP)." };
    const previous = await db.target.findUniqueOrThrow({ where: { id: targetId } });
    // Without a world, scanning the page can only show its AR content.
    await db.target.update({ where: { id: targetId }, data: url ? { worldUrl: url } : { worldUrl: null, scanAction: "ar" } });
    if (previous.worldUrl && previous.worldUrl !== url) await deleteUpload(previous.worldUrl);
    refreshAll();
    return { ok: true, message: url ? "Story world saved" : "Story world removed" };
  } catch (error) {
    return failure(error);
  }
}

/** What moves inside the page's story room (rain, snow, or nothing). */
export async function setPageWorldEffect(targetId: string, effect: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (!(WORLD_EFFECTS as readonly string[]).includes(effect)) return { error: "Choose rain, snow or nothing." };
    await db.target.update({ where: { id: targetId }, data: { worldEffect: effect } });
    refreshAll();
    return { ok: true, message: effect === "none" ? "Nothing moves in the story world now" : `${WORLD_EFFECT_LABEL[effect as WorldEffect]} saved` };
  } catch (error) {
    return failure(error);
  }
}

/** The single page experience used in the reader and when its printed target is recognised. */
export async function savePageScanAction(targetId: string, action: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (!(SCAN_ACTIONS as readonly string[]).includes(action)) return { error: "Choose a model engine, Step Inside, or 360° view." };
    const target = await db.target.findUniqueOrThrow({ where: { id: targetId }, include: { contents: { orderBy: { order: "asc" } } } });
    if ((action === "world" || action === "panorama") && !target.worldUrl) return { error: "Add a story world to this page first." };
    if (opensModel(action) && !placementModel(target.contents)) return { error: "Add a 3D model or 3D text to this page first." };
    await db.target.update({ where: { id: targetId }, data: { scanAction: action } });
    refreshAll();
    return { ok: true, message: action === "world" ? "This page now opens the story box automatically" : action === "panorama" ? "This page now opens the 360° view" : action === "quicklook" ? "Scanning now opens AR Quick Look" : action === "eighthwall" ? "Scanning now opens the 8th Wall model" : "Scanning now shows content with MindAR" };
  } catch (error) {
    return failure(error);
  }
}

/** The voice that reads a page aloud in the reader; null removes it. */
export async function setPageNarration(targetId: string, url: string | null): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (url !== null && !url.startsWith("/files/audio/")) return { error: "Upload an audio file (MP3, M4A, OGG or WAV)." };
    const previous = await db.target.findUniqueOrThrow({ where: { id: targetId } });
    await db.target.update({ where: { id: targetId }, data: { narrationUrl: url } });
    if (previous.narrationUrl && previous.narrationUrl !== url) await deleteUpload(previous.narrationUrl);
    refreshAll();
    return { ok: true, message: url ? "Narration saved: tap Read to me in the reader to hear it" : "Narration removed" };
  } catch (error) {
    return failure(error);
  }
}

// ---------- Sounds that play on their own in the page's experience ----------

const soundSettings = z.object({
  name: z.string().trim().min(1, "Give the sound a name").max(60),
  volume: z.number().min(0).max(1),
  loop: z.boolean(),
  delay: z.number().min(0).max(120),
});

/** Adds an uploaded sound to the page: a scene sound or a reading soundtrack, up to SOUND_LIMIT of each. */
export async function addPageSound(targetId: string, input: { name: string; url: string; kind: SoundKind }): Promise<ActionState<PageSoundRow>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (!input.url.startsWith("/files/audio/")) return { error: "Upload an audio file (MP3, M4A, OGG or WAV)." };
    const kind = soundKindOf(input.kind);
    const count = await db.pageSound.count({ where: { targetId, kind } });
    if (count >= SOUND_LIMIT[kind]) return { error: `A page can mix up to ${SOUND_LIMIT[kind]} of these. Remove one first.` };
    const name = input.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 60) || "Sound";
    const sound = await db.pageSound.create({ data: { targetId, kind, name, url: input.url, order: count } });
    refreshAll();
    return { ok: true, message: kind === "reading" ? "Soundtrack added: readers can turn it on while they read" : "Sound added: it plays on its own in this page's experience", data: pageSoundRow(sound) };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePageSound(soundId: string, input: z.input<typeof soundSettings>): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = soundSettings.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await db.pageSound.update({ where: { id: soundId }, data: parsed.data });
    refreshAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePageSound(soundId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const sound = await db.pageSound.delete({ where: { id: soundId } });
    // The same file may still be used by another page's sound.
    if ((await db.pageSound.count({ where: { url: sound.url } })) === 0) await deleteUpload(sound.url);
    refreshAll();
    return { ok: true, message: "Sound removed" };
  } catch (error) {
    return failure(error);
  }
}

export async function moveTarget(targetId: string, direction: -1 | 1): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const target = await db.target.findUniqueOrThrow({ where: { id: targetId } });
    const siblings = await db.target.findMany({ where: { bookId: target.bookId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    const index = siblings.findIndex((t) => t.id === targetId);
    const swap = siblings[index + direction];
    if (!swap) return { ok: true };
    const reordered = [...siblings];
    reordered[index] = swap;
    reordered[index + direction] = target;
    const order = JSON.stringify(reordered.map(({ id }) => id));
    const changed = await db.$executeRaw(Prisma.sql`
      UPDATE "Target" SET "order" = newOrder.key, "updatedAt" = ${new Date()}
      FROM json_each(${order}) AS newOrder
      WHERE "Target"."bookId" = ${target.bookId} AND "Target"."id" = newOrder.value
        AND (SELECT COUNT(*) FROM "Target" WHERE "bookId" = ${target.bookId}) = ${reordered.length}
        AND (SELECT COUNT(*) FROM "Target" WHERE "id" IN (SELECT value FROM json_each(${order}))) = ${reordered.length}
    `);
    if (!changed) return { error: "The pages changed. Refresh the book and try again." };
    refreshAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTarget(targetId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const target = await db.target.delete({ where: { id: targetId }, include: { contents: true, sounds: true } });
    await Promise.all([target.imageUrl, target.narrationUrl, target.worldUrl, ...target.contents.map((c) => c.url), ...target.sounds.map((s) => s.url)].map((url) => deleteUpload(url)));
    refreshAll();
    return { ok: true, message: "Page deleted — recompile the book to apply" };
  } catch (error) {
    return failure(error);
  }
}

// ---------- Content placed on a target ----------

/** Duplicated items share one uploaded file; only delete it once nothing points at it. */
async function deleteContentFileIfUnused(url: string | null) {
  if (url && (await db.content.count({ where: { url } })) === 0) await deleteUpload(url);
}

const newContent = z.object({
  type: z.enum(CONTENT_TYPES),
  name: z.string().min(1).max(120),
  url: z.string().startsWith("/files/").nullable(),
  text: z.string().max(500).nullable(),
});

const DEFAULT_COLOR: Partial<Record<ContentData["type"], string>> = { TEXT: "#ffffff", TEXT3D: "#f26a1a" };

export async function addContent(targetId: string, input: z.input<typeof newContent>): Promise<ActionState<ContentData>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = newContent.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const count = await db.content.count({ where: { targetId } });
    const content = await db.content.create({
      data: {
        ...parsed.data,
        ...defaultTransform(parsed.data.type),
        targetId,
        order: count,
        color: DEFAULT_COLOR[parsed.data.type] ?? null,
      },
    });
    refreshAll();
    return { ok: true, data: content as ContentData };
  } catch (error) {
    return failure(error);
  }
}

/** Swap the file behind a model / video / image / audio item, keeping its placement and animation. */
export async function replaceContentFile(contentId: string, url: string): Promise<ActionState<ContentData>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const content = await db.content.findUniqueOrThrow({ where: { id: contentId } });
    const kind = CONTENT_META[content.type as ContentData["type"]]?.uploadKind;
    if (!kind || !url.startsWith(`/files/${kind}/`)) return { error: "That file doesn't fit this item." };
    const updated = await db.content.update({
      where: { id: contentId },
      // A different GLB has different clips, so go back to playing all of them.
      data: { url, animation: content.type === "MODEL" ? null : content.animation },
    });
    await deleteContentFileIfUnused(content.url);
    refreshAll();
    return { ok: true, message: "Replaced", data: updated as ContentData };
  } catch (error) {
    return failure(error);
  }
}

export async function duplicateContent(contentId: string): Promise<ActionState<ContentData>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const { id, createdAt, updatedAt, ...source } = await db.content.findUniqueOrThrow({ where: { id: contentId } });
    void id;
    void createdAt;
    void updatedAt;
    const count = await db.content.count({ where: { targetId: source.targetId } });
    const copy = await db.content.create({
      data: { ...source, name: `${source.name} copy`.slice(0, 120), posX: source.posX + 0.08, order: count },
    });
    refreshAll();
    return { ok: true, message: "Duplicated", data: copy as ContentData };
  } catch (error) {
    return failure(error);
  }
}

const finite = z.number().finite();
const contentUpdate = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  text: z.string().max(500).nullable(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
  posX: finite,
  posY: finite,
  posZ: finite,
  rotX: finite,
  rotY: finite,
  rotZ: finite,
  scale: z.number().positive().max(100),
  autoplay: z.boolean(),
  loop: z.boolean(),
  animation: z.string().max(120).nullable(),
  motion: z
    .string()
    .max(100_000)
    .nullable()
    .refine((json) => json === null || parseMotion(json) !== null, "Invalid animation data"),
});

export async function saveContents(targetId: string, items: z.input<typeof contentUpdate>[]): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = z.array(contentUpdate).safeParse(items);
    if (!parsed.success) return invalid(parsed.error);
    if (parsed.data.length) {
      const content = JSON.stringify(parsed.data);
      const fields = Prisma.join([
        "name", "text", "color", "posX", "posY", "posZ", "rotX", "rotY", "rotZ",
        "scale", "autoplay", "loop", "animation", "motion",
      ].map((field) => Prisma.sql`${Prisma.raw(`"${field}"`)} = json_extract(item.value, ${`$.${field}`})`));
      const changed = await db.$executeRaw(Prisma.sql`
        UPDATE "Content" SET ${fields}, "order" = item.key, "updatedAt" = ${new Date()}
        FROM json_each(${content}) AS item
        WHERE "Content"."id" = json_extract(item.value, '$.id') AND "Content"."targetId" = ${targetId}
          AND (SELECT COUNT(*) FROM "Content" WHERE "targetId" = ${targetId}
            AND "id" IN (SELECT json_extract(value, '$.id') FROM json_each(${content}))) = ${parsed.data.length}
      `);
      if (changed !== parsed.data.length) return { error: "The scene changed. Reopen it and try again." };
    }
    refreshAll();
    return { ok: true, message: "Scene saved" };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteContent(contentId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const content = await db.content.delete({ where: { id: contentId } });
    await deleteContentFileIfUnused(content.url);
    refreshAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
