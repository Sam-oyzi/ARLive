"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { assertRole, AuthError, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/roles";
import { randomPassword, slugify } from "@/lib/utils";
import { failure, invalid, parseForm, refreshAll, type ActionState } from "../forms";

/** Platform admins manage everyone; school admins only their own school's students. */
async function assertCanManage(actor: CurrentUser, userId: string) {
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new AuthError("User not found.");
  if (target.id === actor.id) throw new AuthError("You can't do that to your own account.");
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
  .refine((u) => u.role === "SUPER_ADMIN" || !!u.schoolId, { message: "Pick a school", path: ["schoolId"] });

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
        schoolId: data.role === "SUPER_ADMIN" ? null : data.schoolId,
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
    return { ok: true, message: active ? "Account enabled" : "Account disabled" };
  } catch (error) {
    return failure(error);
  }
}

export async function resetPassword(userId: string): Promise<ActionState<{ password: string }>> {
  try {
    const actor = await assertRole(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
    await assertCanManage(actor, userId);
    const password = randomPassword(8);
    await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
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
    return { ok: true, message: "User deleted" };
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

async function freeUsername(base: string) {
  const clean = base.replace(/[^a-z0-9.]/g, "").slice(0, 24) || "student";
  let username = clean;
  for (let i = 2; await db.user.findUnique({ where: { username } }); i++) username = `${clean}${i}`;
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
    if (!schoolId) return { error: "Pick a school." };
    const parsed = parseForm(bulkSchema, formData);
    if (!parsed.success) return invalid(parsed.error);

    const names = parsed.data.names
      .split(/\r?\n/)
      .map((n) => n.trim().replace(/\s+/g, " "))
      .filter((n) => n.length >= 2);
    if (names.length === 0) return { error: "Add at least one full name, one per line." };
    if (names.length > 300) return { error: "Add at most 300 students at a time." };
    const capacity = await studentCapacity(schoolId);
    if (names.length > capacity) return { error: `Your plan allows ${Math.max(0, capacity)} more student(s).` };

    const created: CreatedStudent[] = [];
    for (const name of names) {
      const username = await freeUsername(usernameFromName(name));
      const password = randomPassword(8);
      await db.user.create({
        data: { name, username, role: "STUDENT", schoolId, grade: parsed.data.grade, passwordHash: await bcrypt.hash(password, 10) },
      });
      created.push({ name, username, password });
    }
    refreshAll();
    return { ok: true, data: created, message: `${created.length} student account(s) created` };
  } catch (error) {
    return failure(error);
  }
}
