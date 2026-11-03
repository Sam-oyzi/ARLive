"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, invalid, parseForm, refreshAll, type ActionState } from "../forms";

const MAX_CHILDREN = 8;

const profileSchema = z.object({
  name: z.string({ error: "Enter your name" }).min(2, "Enter your name").max(80),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    const parsed = parseForm(profileSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
    refreshAll();
    return { ok: true, message: "Profile saved" };
  } catch (error) {
    return failure(error);
  }
}

const childSchema = z.object({
  id: z.string().optional(),
  name: z.string({ error: "Enter a first name or nickname" }).min(1).max(40),
  age: z.coerce.number().int().min(0, "Age 0 to 14").max(14, "Age 0 to 14").optional(),
  interests: z.string().max(300).optional(),
});

export async function saveChild(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    const parsed = parseForm(childSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    const fields = { name: data.name, age: data.age ?? null, interests: data.interests ?? null };
    if (id) {
      // updateMany scopes the write to this parent's own children.
      const { count } = await db.child.updateMany({ where: { id, parentId: user.id }, data: fields });
      if (count === 0) return { error: "Child not found." };
    } else {
      if ((await db.child.count({ where: { parentId: user.id } })) >= MAX_CHILDREN) {
        return { error: `You can add up to ${MAX_CHILDREN} children.` };
      }
      await db.child.create({ data: { ...fields, parentId: user.id } });
    }
    refreshAll();
    return { ok: true, message: id ? "Saved" : `${fields.name} added` };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteChild(childId: string): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    await db.child.deleteMany({ where: { id: childId, parentId: user.id } });
    refreshAll();
    return { ok: true, message: "Removed" };
  } catch (error) {
    return failure(error);
  }
}
