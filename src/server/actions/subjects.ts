"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUBJECT_ICONS } from "@/lib/subject-icons";
import { slugify } from "@/lib/utils";
import { failure, hexColor, invalid, optionalInt, parseForm, refreshAll, type ActionState } from "../forms";

const subjectSchema = z.object({
  id: z.string().optional(),
  name: z.string({ error: "Enter a subject name" }).min(2).max(60),
  description: z.string().max(300).optional(),
  icon: z.string().refine((icon) => icon in SUBJECT_ICONS, "Pick an icon"),
  color: hexColor,
  order: optionalInt,
});

export async function saveSubject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(subjectSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;

    const base = slugify(data.name) || "subject";
    let slug = base;
    for (let i = 2; await db.subject.findFirst({ where: { slug, NOT: id ? { id } : undefined } }); i++) slug = `${base}-${i}`;

    if (id) await db.subject.update({ where: { id }, data: { ...data, order: data.order ?? 0, slug } });
    else {
      const order = data.order ?? (await db.subject.count());
      await db.subject.create({ data: { ...data, order, slug } });
    }
    refreshAll();
    return { ok: true, message: id ? "Subject updated" : "Subject created" };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSubject(id: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const books = await db.book.count({ where: { subjectId: id } });
    if (books > 0) return { error: `Move or delete its ${books} book(s) first.` };
    await db.subject.delete({ where: { id } });
    refreshAll();
    return { ok: true, message: "Subject deleted" };
  } catch (error) {
    return failure(error);
  }
}
