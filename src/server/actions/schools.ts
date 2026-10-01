"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { assertRole, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/storage";
import { randomCode, slugify } from "@/lib/utils";
import { failure, hexColor, invalid, optionalInt, parseForm, refreshAll, type ActionState } from "../forms";

const schoolSchema = z.object({
  id: z.string().optional(),
  name: z.string({ error: "Enter the school name" }).min(2).max(120),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  contactEmail: z.email("Enter a valid email").optional(),
  color: hexColor.default("#5b5bf6"),
  maxStudents: optionalInt,
  logoUrl: z.string().startsWith("/files/").optional(),
});

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name) || "school";
  let slug = base;
  for (let i = 2; await db.school.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

async function uniqueJoinCode() {
  let code = randomCode(8);
  while (await db.school.findUnique({ where: { joinCode: code } })) code = randomCode(8);
  return code;
}

export async function saveSchool(_prev: ActionState<{ id: string }>, formData: FormData): Promise<ActionState<{ id: string }>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(schoolSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    const fields = { ...data, maxStudents: data.maxStudents || null, logoUrl: data.logoUrl ?? null };

    if (id) {
      const previous = await db.school.findUniqueOrThrow({ where: { id } });
      await db.school.update({ where: { id }, data: { ...fields, slug: await uniqueSlug(data.name, id) } });
      if (previous.logoUrl && previous.logoUrl !== fields.logoUrl) await deleteUpload(previous.logoUrl);
      refreshAll();
      return { ok: true, message: "School updated", data: { id } };
    }
    const school = await db.school.create({
      data: { ...fields, slug: await uniqueSlug(data.name), joinCode: await uniqueJoinCode() },
    });
    refreshAll();
    return { ok: true, message: "School created", data: { id: school.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function setSchoolActive(schoolId: string, active: boolean): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    await db.school.update({ where: { id: schoolId }, data: { active } });
    refreshAll();
    return { ok: true, message: active ? "School activated" : "School paused — its users can't sign in" };
  } catch (error) {
    return failure(error);
  }
}

export async function regenerateJoinCode(schoolId: string): Promise<ActionState> {
  try {
    const user = await assertRole(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
    if (user.role === "SCHOOL_ADMIN" && user.schoolId !== schoolId) throw new AuthError();
    await db.school.update({ where: { id: schoolId }, data: { joinCode: await uniqueJoinCode() } });
    refreshAll();
    return { ok: true, message: "New join code generated" };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSchool(schoolId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const school = await db.school.delete({ where: { id: schoolId } });
    await deleteUpload(school.logoUrl);
    refreshAll();
    return { ok: true, message: "School deleted" };
  } catch (error) {
    return failure(error);
  }
}

/** Grant or revoke a set of books for a school (one book, or every book of a subject). */
export async function setSchoolAccess(schoolId: string, bookIds: string[], granted: boolean): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    if (granted) {
      const existing = await db.schoolBook.findMany({ where: { schoolId, bookId: { in: bookIds } } });
      const have = new Set(existing.map((e) => e.bookId));
      await db.schoolBook.createMany({ data: bookIds.filter((b) => !have.has(b)).map((bookId) => ({ schoolId, bookId })) });
      // Any pending requests for these books are now satisfied.
      await db.accessRequest.updateMany({
        where: { schoolId, bookId: { in: bookIds }, status: "PENDING" },
        data: { status: "APPROVED", decidedAt: new Date() },
      });
    } else {
      await db.schoolBook.deleteMany({ where: { schoolId, bookId: { in: bookIds } } });
    }
    refreshAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

const adminSchema = z.object({
  schoolId: z.string(),
  name: z.string({ error: "Enter a name" }).min(2).max(80),
  username: z.email("Use an email address as the username").toLowerCase(),
  password: z.string({ error: "Set a password" }).min(8, "At least 8 characters"),
});

export async function createSchoolAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(adminSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { schoolId, name, username, password } = parsed.data;
    if (await db.user.findUnique({ where: { username } })) return { error: "That email already has an account." };
    await db.user.create({
      data: { name, username, schoolId, role: "SCHOOL_ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    });
    refreshAll();
    return { ok: true, message: "School admin created" };
  } catch (error) {
    return failure(error);
  }
}
