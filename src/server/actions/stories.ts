"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { goalLabel, STORY_GOAL_KEYS, STORY_LANGUAGES } from "@/lib/stories";
import { failure, invalid, parseForm, refreshAll, type ActionState } from "../forms";

// A family can have this many requests waiting at once.
const MAX_OPEN_REQUESTS = 3;

const requestSchema = z.object({
  childId: z.string().optional(),
  childName: z.string({ error: "Who is the story for?" }).min(1, "Who is the story for?").max(40),
  childAge: z.coerce.number().int().min(0, "Age 0 to 14").max(14, "Age 0 to 14").optional(),
  goal: z.enum(STORY_GOAL_KEYS, { error: "Pick what the story should help with" }),
  message: z.string({ error: "Tell us what you'd like your child to learn" }).min(10, "Tell us a little more (10 characters or more)").max(1500),
  interests: z.string().max(300).optional(),
  language: z.enum(STORY_LANGUAGES).default("en"),
});

export async function createStoryRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    const parsed = parseForm(requestSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { childId, ...data } = parsed.data;

    const open = await db.storyRequest.count({ where: { userId: user.id, status: { in: ["NEW", "IN_PROGRESS"] } } });
    if (open >= MAX_OPEN_REQUESTS) {
      return { error: `You already have ${open} stories on the way. You can ask for another once one is ready.` };
    }
    const child = childId ? await db.child.findFirst({ where: { id: childId, parentId: user.id } }) : null;
    await db.storyRequest.create({
      data: {
        ...data,
        userId: user.id,
        childId: child?.id ?? null,
        childAge: data.childAge ?? child?.age ?? null,
        interests: data.interests ?? child?.interests ?? null,
      },
    });
    refreshAll();
    return { ok: true, message: `Request sent! We'll start writing ${data.childName}'s story soon.` };
  } catch (error) {
    return failure(error);
  }
}

/** Parents can withdraw a request until the team starts on it. */
export async function cancelStoryRequest(requestId: string): Promise<ActionState> {
  try {
    const user = await assertRole(["PARENT"]);
    const { count } = await db.storyRequest.deleteMany({ where: { id: requestId, userId: user.id, status: "NEW" } });
    if (count === 0) return { error: "This request is already being written." };
    refreshAll();
    return { ok: true, message: "Request withdrawn" };
  } catch (error) {
    return failure(error);
  }
}

// ---------- Admin ----------

/** Starts the custom book: a draft owned by the family, opened in the studio next. */
export async function startStoryBook(requestId: string): Promise<ActionState<{ bookId: string }>> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const request = await db.storyRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (request.bookId) return { ok: true, data: { bookId: request.bookId } };
    const category = await db.subject.findFirst({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    if (!category) return { error: "Create a category first." };

    const book = await db.$transaction(async (tx) => {
      const created = await tx.book.create({
        data: {
          title: `${request.childName}'s story`,
          description: `A custom story for ${request.childName}: ${goalLabel(request.goal).toLowerCase()}.`,
          gradeLevel: request.childAge != null ? `Age ${request.childAge}` : null,
          subjectId: category.id,
          ownerId: request.userId,
        },
      });
      await tx.storyRequest.update({ where: { id: requestId }, data: { bookId: created.id, status: "IN_PROGRESS" } });
      return created;
    });
    refreshAll();
    return { ok: true, message: "Draft book created", data: { bookId: book.id } };
  } catch (error) {
    return failure(error);
  }
}

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(["NEW", "IN_PROGRESS", "DECLINED"]),
  adminNote: z.string().max(1000).optional(),
});

export async function updateStoryRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = parseForm(updateSchema, formData);
    if (!parsed.success) return invalid(parsed.error);
    const { id, status, adminNote } = parsed.data;
    const request = await db.storyRequest.findUniqueOrThrow({ where: { id } });
    // Delivering goes through deliverStory, which publishes the book too.
    const next = request.status === "DELIVERED" ? "DELIVERED" : status;
    await db.storyRequest.update({ where: { id }, data: { status: next, adminNote: adminNote ?? null } });
    refreshAll();
    return { ok: true, message: "Request updated" };
  } catch (error) {
    return failure(error);
  }
}

/** Publishes the custom book for the family and marks the request delivered. */
export async function deliverStory(requestId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const request = await db.storyRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { book: { include: { targets: { select: { ar: true } } } } },
    });
    const book = request.book;
    if (!book) return { error: "Create the book first." };
    if (book.targets.length === 0) return { error: "Add the story's pages in the studio first." };
    if (book.targets.some((t) => t.ar) && !book.mindUrl) return { error: "Compile the AR pages in the studio first." };

    await db.$transaction([
      db.book.update({ where: { id: book.id }, data: { published: true, ownerId: request.userId } }),
      db.storyRequest.update({ where: { id: requestId }, data: { status: "DELIVERED", deliveredAt: new Date() } }),
    ]);
    refreshAll();
    return { ok: true, message: `Delivered to ${request.childName}'s family` };
  } catch (error) {
    return failure(error);
  }
}
