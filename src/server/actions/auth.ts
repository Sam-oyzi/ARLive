"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/roles";
import { echoValues, failure, invalid, parseForm, type ActionState } from "../forms";

// Compared against when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Y5Yb6dO7kQ6wV4G1oCrZQ5Kk7v2e";

function safeNext(next: unknown, fallback: string) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

const loginSchema = z.object({
  username: z.string({ error: "Enter your username" }).toLowerCase(),
  password: z.string({ error: "Enter your password" }),
  next: z.string().optional(),
});

/** On error, echo the typed values back so the form doesn't come back empty. */
function keepValues(result: ActionState, formData: FormData): ActionState {
  return result?.error ? { ...result, values: echoValues(formData) } : result;
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return keepValues(await attemptLogin(formData), formData);
}

async function attemptLogin(formData: FormData): Promise<ActionState> {
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.success) return invalid(parsed.error);
  const { username, password, next } = parsed.data;

  const user = await db.user.findUnique({ where: { username }, include: { school: true } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "Wrong username or password." };
  if (!user.active) return { error: "This account is disabled. Please contact your school." };
  if (user.school && !user.school.active && user.role !== "SUPER_ADMIN") {
    return { error: "Your school's access is paused. Please contact your school." };
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  const home = homeFor(user.role);
  // Only follow ?next= into the area this role can actually open.
  const target = safeNext(next, home);
  redirect(target.startsWith(home) || target.startsWith("/scan") ? target : home);
}

const joinSchema = z.object({
  // Forgiving about case, spaces and dashes: "demo 2026" works too.
  joinCode: z
    .string({ error: "Enter your school code" })
    .transform((code) => code.toUpperCase().replace(/[\s-]/g, "")),
  name: z.string({ error: "Enter your full name" }).min(2, "Enter your full name").max(80),
  username: z
    .string({ error: "Choose a username" })
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "3–30 letters, numbers, dots, dashes or underscores"),
  password: z.string({ error: "Choose a password" }).min(6, "At least 6 characters"),
  grade: z.string().max(40).optional(),
});

export async function joinSchool(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return keepValues(await attemptJoin(formData), formData);
}

async function attemptJoin(formData: FormData): Promise<ActionState> {
  const parsed = parseForm(joinSchema, formData);
  if (!parsed.success) return invalid(parsed.error);
  const { joinCode, name, username, password, grade } = parsed.data;

  try {
    const school = await db.school.findUnique({
      where: { joinCode },
      include: { _count: { select: { users: { where: { role: "STUDENT" } } } } },
    });
    if (!school || !school.active) return { error: "That school code isn't valid.", fieldErrors: { joinCode: ["Unknown code"] } };
    if (school.maxStudents && school._count.users >= school.maxStudents) {
      return { error: "This school has reached its student limit. Ask your school to contact ARLive." };
    }
    if (await db.user.findUnique({ where: { username } })) {
      return { error: "That username is taken.", fieldErrors: { username: ["Already taken"] } };
    }
    const user = await db.user.create({
      data: {
        name,
        username,
        grade,
        role: "STUDENT",
        schoolId: school.id,
        passwordHash: await bcrypt.hash(password, 10),
        lastLoginAt: new Date(),
      },
    });
    await createSession(user);
  } catch (error) {
    return failure(error);
  }
  redirect("/learn");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
