"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { readStoryLayouts, storyBlocksSchema, type StoryBlock } from "@/lib/story-layout";
import { failure, invalid, type ActionState } from "../forms";

export async function saveStoryLayout(bookId: string, targetId: string, language: string, blocks: StoryBlock[] | null): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = storyBlocksSchema.nullable().safeParse(blocks);
    if (!parsed.success) return invalid(parsed.error);
    await db.$transaction(async (tx) => {
      const target = await tx.target.findUniqueOrThrow({ where: { id: targetId, bookId }, select: { storyLayouts: true, translations: true } });
      const translations = pageTranslationsSchema.safeParse(target.translations).data ?? {};
      if (language && !Object.hasOwn(translations, language)) throw new Error("This page has no translation in that language.");
      const layouts = readStoryLayouts(target.storyLayouts);
      const key = language || "original";
      if (parsed.data === null) delete layouts[key];
      else layouts[key] = parsed.data;
      await tx.target.update({ where: { id: targetId, bookId }, data: { storyLayouts: layouts } });
    });
    revalidatePath(`/admin/books/${bookId}/words`);
    revalidatePath(`/read/${bookId}`);
    revalidatePath(`/print/${bookId}`);
    return { ok: true, message: "Page text saved" };
  } catch (error) {
    return failure(error);
  }
}
