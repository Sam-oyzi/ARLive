"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { assertRole, AuthError, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { needsSchool, ROLES } from "@/lib/roles";
import { randomPassword, slugify } from "@/lib/utils";
import { wordsFor } from "@/lib/i18n/server";
import { failure, invalid, parseForm, refreshAll, type ActionState } from "../forms";

/** Platform admins manage everyone; school admins only their own school's students. */
async function assertCanManage(actor: CurrentUser, userId: string) {
  const target = await db.user.findUnique({ where: { id: userId } });
  const say = (await wordsFor(actor.role)).server;
  if (!target) throw new AuthError(say.userNotFound);
  if (target.id === actor.id) throw new AuthError(say.notYourself);
  if (actor.role === "SUPER_ADMIN") return target;
  if (actor.role === "SCHOOL_ADMIN" && target.role === "STUDENT" && target.schoolId === actor.schoolId) return target;
  throw new AuthError();
}

const userSchema = z
  .object({
    name: z.string({ error: "Enter a name" }).min(2).max(80),
    username: z
      .string({ error: "Enter a username" })
      .toLowerCase()
      .regex(/^[a-z0-9._@+-]{3,80}$/, "3+ characters: letters, numbers, . _ - @"),
    password: z.string({ error: "Set a password" }).min(6, "At least 6 characters"),
    role: z.enum(ROLES),
    schoolId: z.string().optional(),
    grade: z.string().max(40).optional(),
  })
  .refine((u) => !needsSchool(u.role) || !!u.schoolId, { message: "Pick a school", path: ["schoolId"] });

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(userSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { password, ...data } = parsed.data;
    if (await db.user.findUnique({ where: { username: data.username } })) return { error: "That username is taken." };
    await db.user.create({
      data: {
        ...data,
        schoolId: needsSchool(data.role) ? data.schoolId : null,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    refreshAll();
    return { ok: true, message: "User created" };
  } catch (error) {
    return failure(error);
  }
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionState> {
  try {
    const actor = await assertRole(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
    await assertCanManage(actor, userId);
    await db.user.update({ where: { id: userId }, data: { active } });
    refreshAll();
    const say = (await wordsFor(actor.role)).server;
    return { ok: true, message: active ? say.accountEnabled : say.accountDisabled };
  } catch (error) {
    return failure(error);
  }
}

export async function resetPassword(userId: string): Promise<ActionState<{ password: string }>> {
  try {
    const actor = await assertRole(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
    await assertCanManage(actor, userId);
    const password = randomPassword(8);
    await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10), passwordChangedAt: new Date() } });
    return { ok: true, data: { password } };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteUser(userId: string): Promise<ActionState> {
  try {
    const actor = await assertRole(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
    await assertCanManage(actor, userId);
    await db.user.delete({ where: { id: userId } });
    refreshAll();
    return { ok: true, message: (await wordsFor(actor.role)).server.userDeleted };
  } catch (error) {
    return failure(error);
  }
}

// ---------- School admins managing their students ----------

async function studentCapacity(schoolId: string) {
  const school = await db.school.findUniqueOrThrow({
    where: { id: schoolId },
    include: { _count: { select: { users: { where: { role: "STUDENT" } } } } },
  });
  return school.maxStudents ? school.maxStudents - school._count.users : Infinity;
}

async function freeUsername(base: string, reserved: Set<string>) {
  const clean = base.replace(/[^a-z0-9.]/g, "").slice(0, 24) || "student";
  let username = clean;
  for (let i = 2; reserved.has(username) || (await db.user.findUnique({ where: { username } })); i++) username = `${clean}${i}`;
  reserved.add(username);
  return username;
}

/** "Amina El Idrissi" -> "amina.elidrissi" */
function usernameFromName(name: string) {
  const [first = "", ...rest] = slugify(name).split("-");
  return rest.length ? `${first}.${rest.join("")}` : first;
}

const bulkSchema = z.object({
  names: z.string({ error: "Add at least one name" }),
  grade: z.string().max(40).optional(),
});

export type CreatedStudent = { name: string; username: string; password: string };

export async function createStudents(
  _prev: ActionState<CreatedStudent[]>,
  formData: FormData,
): Promise<ActionState<CreatedStudent[]>> {
  try {
    const actor = await assertRole(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
    const schoolId = actor.role === "SCHOOL_ADMIN" ? actor.schoolId : String(formData.get("schoolId") ?? "");
    const say = (await wordsFor(actor.role)).server;
    if (!schoolId) return { error: "Pick a school." };
    const parsed = parseForm(bulkSchema, formData);
    if (!parsed.success) return invalid(parsed.error);

    const names = parsed.data.names
      .split(/\r?\n/)
      .map((n) => n.trim().replace(/\s+/g, " "))
      .filter((n) => n.length >= 2);
    if (names.length === 0) return { error: say.addOneName };
    if (names.length > 300) return { error: say.max300 };
    const capacity = await studentCapacity(schoolId);
    if (names.length > capacity) return { error: say.planAllows(Math.max(0, capacity)) };

    const created: CreatedStudent[] = [];
    const reserved = new Set<string>();
    for (const name of names) {
      created.push({ name, username: await freeUsername(usernameFromName(name), reserved), password: randomPassword(8) });
    }
    // All or nothing: the passwords are only ever shown in this response, so a partial failure
    // would leave accounts nobody can sign in to.
    const hashes = await Promise.all(created.map((s) => bcrypt.hash(s.password, 10)));
    await db.user.createMany({
      data: created.map((s, i) => ({ name: s.name, username: s.username, role: "STUDENT", schoolId, grade: parsed.data.grade, passwordHash: hashes[i]! })),
    });
    refreshAll();
    return { ok: true, data: created, message: say.studentsCreated(created.length) };
  } catch (error) {
    return failure(error);
  }
}
