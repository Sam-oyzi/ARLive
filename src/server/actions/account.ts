"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { failure, invalid, parseForm, refreshAll, type ActionState } from "../forms";

type Say = Messages["server"];

const MAX_CHILDREN = 8;

const profileSchema = (say: Say) =>
  z.object({
    name: z.string({ error: say.enterName }).min(2, say.enterName).max(80),
  });

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    const say = (await getI18n()).t.server;
    const parsed = parseForm(profileSchema(say), formData);
    if (!parsed.success) return invalid(parsed.error);
    await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
    refreshAll();
    return { ok: true, message: say.profileSaved };
  } catch (error) {
    return failure(error);
  }
}

const childSchema = (say: Say) =>
  z.object({
    id: z.string().optional(),
    name: z.string({ error: say.enterChildName }).min(1, say.enterChildName).max(40),
    age: z.coerce.number().int().min(0, say.age).max(14, say.age).optional(),
    interests: z.string().max(300).optional(),
  });

export async function saveChild(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    const say = (await getI18n()).t.server;
    const parsed = parseForm(childSchema(say), formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    const fields = { name: data.name, age: data.age ?? null, interests: data.interests ?? null };
    if (id) {
      // updateMany scopes the write to this parent's own children.
      const { count } = await db.child.updateMany({ where: { id, parentId: user.id }, data: fields });
      if (count === 0) return { error: say.childNotFound };
    } else {
      if ((await db.child.count({ where: { parentId: user.id } })) >= MAX_CHILDREN) {
        return { error: say.maxChildren(MAX_CHILDREN) };
      }
      await db.child.create({ data: { ...fields, parentId: user.id } });
    }
    refreshAll();
    return { ok: true, message: id ? say.saved : say.added(fields.name) };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteChild(childId: string): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    await db.child.deleteMany({ where: { id: childId, parentId: user.id } });
    refreshAll();
    return { ok: true, message: (await getI18n()).t.server.removed };
  } catch (error) {
    return failure(error);
  }
}
