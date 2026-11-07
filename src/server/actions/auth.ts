"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clearFailures, isBlocked, recordFailure } from "@/lib/rate-limit";
import { afterLoginPath } from "@/lib/roles";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { echoValues, failure, invalid, parseForm, type ActionState } from "../forms";

type Say = Messages["server"];

// Compared against when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Y5Yb6dO7kQ6wV4G1oCrZQ5Kk7v2e";

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
// Strict per account so rotating addresses doesn't help; loose per address because a whole class
// usually shares one.
const LOGIN_LIMIT_PER_USER = 20;
const LOGIN_LIMIT_PER_IP = 200;
const JOIN_LIMIT_PER_IP = 30;
const SIGNUP_LIMIT_PER_IP = 20;
const PASSWORD_LIMIT_PER_USER = 10;

async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// Built per request, so their messages come in the visitor's language.
const loginSchema = (say: Say) =>
  z.object({
    username: z.string({ error: say.enterUsername }).toLowerCase(),
    password: z.string({ error: say.enterPassword }),
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
  const say = (await getI18n()).t.server;
  const parsed = parseForm(loginSchema(say), formData);
  if (!parsed.success) return invalid(parsed.error);
  const { username, password, next } = parsed.data;

  const userKey = `login:user:${username}`;
  const ipKey = `login:ip:${await clientIp()}`;
  if (isBlocked(userKey, LOGIN_LIMIT_PER_USER) || isBlocked(ipKey, LOGIN_LIMIT_PER_IP)) return { error: say.tooMany };

  const user = await db.user.findUnique({ where: { username }, include: { school: true } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    recordFailure(userKey, ATTEMPT_WINDOW_MS);
    recordFailure(ipKey, ATTEMPT_WINDOW_MS);
    return { error: say.wrongLogin };
  }
  clearFailures(userKey);
  if (!user.active) return { error: say.disabled };
  if (user.school && !user.school.active && user.role !== "SUPER_ADMIN") {
    return { error: say.schoolPaused };
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  redirect(afterLoginPath(user.role, next));
}

const joinSchema = (say: Say) =>
  z.object({
    // Forgiving about case, spaces and dashes: "demo 2026" works too.
    joinCode: z
      .string({ error: say.enterCode })
      .transform((code) => code.toUpperCase().replace(/[\s-]/g, "")),
    name: z.string({ error: say.enterFullName }).min(2, say.enterFullName).max(80),
    username: z
      .string({ error: say.chooseUsername })
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,30}$/, say.usernameRule),
    password: z.string({ error: say.choosePassword }).min(6, say.atLeast6),
    grade: z.string().max(40).optional(),
  });

export async function joinSchool(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return keepValues(await attemptJoin(formData), formData);
}

async function attemptJoin(formData: FormData): Promise<ActionState> {
  const say = (await getI18n()).t.server;
  const parsed = parseForm(joinSchema(say), formData);
  if (!parsed.success) return invalid(parsed.error);
  const { joinCode, name, username, password, grade } = parsed.data;

  try {
    // Only wrong codes count, so a class signing up together isn't slowed down.
    const ipKey = `join:ip:${await clientIp()}`;
    if (isBlocked(ipKey, JOIN_LIMIT_PER_IP)) return { error: say.tooMany };
    const school = await db.school.findUnique({
      where: { joinCode },
      include: { _count: { select: { users: { where: { role: "STUDENT" } } } } },
    });
    if (!school || !school.active) {
      recordFailure(ipKey, ATTEMPT_WINDOW_MS);
      return { error: say.badCode, fieldErrors: { joinCode: [say.unknownCode] } };
    }
    if (school.maxStudents && school._count.users >= school.maxStudents) {
      return { error: say.schoolFull };
    }
    if (await db.user.findUnique({ where: { username } })) {
      return { error: say.usernameTaken, fieldErrors: { username: [say.alreadyTaken] } };
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

const signupSchema = (say: Say) =>
  z.object({
    name: z.string({ error: say.enterName }).min(2, say.enterName).max(80),
    email: z.email({ error: say.validEmail }).max(120).toLowerCase(),
    // bcrypt only reads the first 72 bytes.
    password: z.string({ error: say.choosePassword }).min(8, say.atLeast8).max(72, say.atMost72),
    next: z.string().optional(),
  });

/** Parents create their own free account to save books and ask for custom stories. */
export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return keepValues(await attemptSignUp(formData), formData);
}

async function attemptSignUp(formData: FormData): Promise<ActionState> {
  const say = (await getI18n()).t.server;
  const parsed = parseForm(signupSchema(say), formData);
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password, next } = parsed.data;

  let target: string;
  try {
    const ipKey = `signup:ip:${await clientIp()}`;
    if (isBlocked(ipKey, SIGNUP_LIMIT_PER_IP)) return { error: say.tooMany };
    // Every sign-up counts here: it stops one address creating accounts in bulk.
    recordFailure(ipKey, ATTEMPT_WINDOW_MS);
    if (await db.user.findUnique({ where: { username: email } })) {
      return { error: say.emailExists, fieldErrors: { email: [say.alreadyRegistered] } };
    }
    const user = await db.user.create({
      data: { name, username: email, role: "PARENT", passwordHash: await bcrypt.hash(password, 10), lastLoginAt: new Date() },
    });
    await createSession(user);
    target = afterLoginPath(user.role, next);
  } catch (error) {
    return failure(error);
  }
  redirect(target);
}

const changePasswordSchema = (say: Say) =>
  z.object({
    currentPassword: z.string({ error: say.enterCurrent }),
    // bcrypt only reads the first 72 bytes.
    newPassword: z.string({ error: say.chooseNew }).min(8, say.atLeast8).max(72, say.atMost72),
  });

/** Changes the signed-in user's own password and signs out their other devices. */
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError("Please sign in again.");
    const say = (await getI18n()).t.server;
    const parsed = parseForm(changePasswordSchema(say), formData);
    if (!parsed.success) return invalid(parsed.error);

    const key = `password:${user.id}`;
    if (isBlocked(key, PASSWORD_LIMIT_PER_USER)) return { error: say.tooMany };
    if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      recordFailure(key, ATTEMPT_WINDOW_MS);
      return { error: say.wrongCurrent, fieldErrors: { currentPassword: [say.noMatch] } };
    }
    clearFailures(key);

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10), passwordChangedAt: new Date() },
    });
    await createSession(user); // this device stays signed in
    return { ok: true, message: say.passwordChanged };
  } catch (error) {
    return failure(error);
  }
}

export async function logout() {
  await destroySession();
  redirect("/");
}
