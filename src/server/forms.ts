import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError } from "@/lib/auth";

export type ActionState<T = undefined> =
  | {
      ok?: boolean;
      error?: string;
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      data?: T;
      /** What the user typed (never passwords), so a form can refill itself after an error. */
      values?: Record<string, string>;
    }
  | undefined;

/** The submitted text fields minus secrets, to echo back with an error. */
export function echoValues(formData: FormData, omit: string[] = ["password"]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION") && !omit.includes(key)) values[key] = value;
  }
  return values;
}

/** Parse FormData into a zod schema; empty strings become undefined so optional fields work. */
export function parseForm<S extends z.ZodType>(schema: S, formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      raw[key] = trimmed === "" ? undefined : trimmed;
    }
  }
  return schema.safeParse(raw);
}

export function invalid(error: z.ZodError): NonNullable<ActionState> {
  const flat = z.flattenError(error);
  const first = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0];
  return { error: typeof first === "string" ? first : "Please check the form.", fieldErrors: flat.fieldErrors as Record<string, string[]> };
}

/** Turn thrown errors into a friendly action result instead of a crashed page. */
export function failure(error: unknown): NonNullable<ActionState> {
  if (error instanceof AuthError) return { error: error.message };
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return { error: "That value is already taken." };
  }
  console.error(error);
  return { error: "Something went wrong. Please try again." };
}

/** Pages read live data from the database, so refresh every rendered route after a mutation. */
export function refreshAll() {
  revalidatePath("/", "layout");
}

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const optionalInt = z.coerce.number().int().min(0).optional();

export const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour");
