"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { storyBlocksSchema, type StoryBlock } from "@/lib/story-layout";
import { failure, invalid, type ActionState } from "../forms";

export async function saveStoryLayout(bookId: string, targetId: string, language: string, blocks: StoryBlock[] | null): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = storyBlocksSchema.nullable().safeParse(blocks);
    if (!parsed.success) return invalid(parsed.error);
    const target = await db.target.findUniqueOrThrow({ where: { id: targetId, bookId }, select: { translations: true } });
    const translations = pageTranslationsSchema.safeParse(target.translations).data ?? {};
    if (language && !Object.hasOwn(translations, language)) throw new Error("This page has no translation in that language.");
    const changes = await db.$executeRaw(Prisma.sql`
      UPDATE "Target" SET "storyLayouts" = json_patch(COALESCE("storyLayouts", '{}'),
        ${JSON.stringify({ [language || "original"]: parsed.data })}), "updatedAt" = ${new Date()}
      WHERE "id" = ${targetId} AND "bookId" = ${bookId}
    `);
    if (!changes) return { error: "Page not found." };
    revalidatePath(`/admin/books/${bookId}/words`);
    revalidatePath(`/read/${bookId}`);
    revalidatePath(`/print/${bookId}`);
    return { ok: true, message: "Page text saved" };
  } catch (error) {
    return failure(error);
  }
}
