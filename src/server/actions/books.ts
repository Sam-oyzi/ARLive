"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { CONTENT_TYPES, defaultTransform, type ContentData } from "@/lib/content";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/storage";
import { failure, invalid, parseForm, refreshAll, type ActionState } from "../forms";

const bookSchema = z.object({
  id: z.string().optional(),
  title: z.string({ error: "Enter a title" }).min(2).max(140),
  description: z.string().max(600).optional(),
  gradeLevel: z.string().max(60).optional(),
  subjectId: z.string({ error: "Pick a subject" }),
  coverUrl: z.string().startsWith("/files/").optional(),
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
      await db.book.update({ where: { id }, data: fields });
      if (previous.coverUrl && previous.coverUrl !== fields.coverUrl) await deleteUpload(previous.coverUrl);
      refreshAll();
      return { ok: true, message: "Book updated", data: { id } };
    }
    const book = await db.book.create({ data: fields });
    refreshAll();
    return { ok: true, message: "Book created", data: { id: book.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function setBookPublished(bookId: string, published: boolean): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (published) {
      const book = await db.book.findUniqueOrThrow({ where: { id: bookId } });
      if (!book.mindUrl) return { error: "Compile the AR targets before publishing." };
    }
    await db.book.update({ where: { id: bookId }, data: { published } });
    refreshAll();
    return { ok: true, message: published ? "Published — students with access can scan it now" : "Moved back to draft" };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBook(bookId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const book = await db.book.findUniqueOrThrow({
      where: { id: bookId },
      include: { targets: { include: { contents: true } } },
    });
    await db.book.delete({ where: { id: bookId } });
    const urls = [book.coverUrl, book.mindUrl, ...book.targets.flatMap((t) => [t.imageUrl, ...t.contents.map((c) => c.url)])];
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
});

export async function updateTarget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(targetSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, name, description } = parsed.data;
    await db.target.update({ where: { id }, data: { name, description: description ?? null } });
    refreshAll();
    return { ok: true, message: "Page details saved" };
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
    await db.$transaction(reordered.map((t, i) => db.target.update({ where: { id: t.id }, data: { order: i } })));
    refreshAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTarget(targetId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const target = await db.target.delete({ where: { id: targetId }, include: { contents: true } });
    await Promise.all([target.imageUrl, ...target.contents.map((c) => c.url)].map((url) => deleteUpload(url)));
    refreshAll();
    return { ok: true, message: "Page deleted — recompile the book to apply" };
  } catch (error) {
    return failure(error);
  }
}

// ---------- Content placed on a target ----------

const newContent = z.object({
  type: z.enum(CONTENT_TYPES),
  name: z.string().min(1).max(120),
  url: z.string().startsWith("/files/").nullable(),
  text: z.string().max(500).nullable(),
});

export async function addContent(targetId: string, input: z.input<typeof newContent>): Promise<ActionState<ContentData>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = newContent.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const count = await db.content.count({ where: { targetId } });
    const content = await db.content.create({
      data: { ...parsed.data, ...defaultTransform(parsed.data.type), targetId, order: count, color: parsed.data.type === "TEXT" ? "#ffffff" : null },
    });
    refreshAll();
    return { ok: true, data: content as ContentData };
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
});

export async function saveContents(targetId: string, items: z.input<typeof contentUpdate>[]): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = z.array(contentUpdate).safeParse(items);
    if (!parsed.success) return invalid(parsed.error);
    await db.$transaction(
      parsed.data.map(({ id, ...data }, order) => db.content.update({ where: { id, targetId }, data: { ...data, order } })),
    );
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
    await deleteUpload(content.url);
    refreshAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
