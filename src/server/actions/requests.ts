"use server";

import { assertRole, assertSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { failure, refreshAll, type ActionState } from "../forms";

/** A school admin asks for access to a published book. */
export async function requestAccess(bookId: string, message?: string): Promise<ActionState> {
  try {
    const admin = await assertSchoolAdmin();
    const say = (await getI18n()).t.server;
    const book = await db.book.findFirst({ where: { id: bookId, published: true } });
    if (!book) return { error: say.bookUnavailable };
    const granted = await db.schoolBook.findUnique({ where: { schoolId_bookId: { schoolId: admin.schoolId, bookId } } });
    if (granted) return { ok: true, message: say.schoolHasBook };
    const pending = await db.accessRequest.findFirst({ where: { schoolId: admin.schoolId, bookId, status: "PENDING" } });
    if (!pending) {
      await db.accessRequest.create({ data: { schoolId: admin.schoolId, bookId, message: message?.slice(0, 500) } });
    }
    refreshAll();
    return { ok: true, message: say.requestToTeam };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelRequest(requestId: string): Promise<ActionState> {
  try {
    const admin = await assertSchoolAdmin();
    await db.accessRequest.deleteMany({ where: { id: requestId, schoolId: admin.schoolId, status: "PENDING" } });
    refreshAll();
    return { ok: true, message: (await getI18n()).t.server.requestCancelled };
  } catch (error) {
    return failure(error);
  }
}

export async function decideRequest(requestId: string, approve: boolean): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const request = await db.accessRequest.update({
      where: { id: requestId },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedAt: new Date() },
    });
    if (approve) {
      await db.schoolBook.upsert({
        where: { schoolId_bookId: { schoolId: request.schoolId, bookId: request.bookId } },
        create: { schoolId: request.schoolId, bookId: request.bookId },
        update: {},
      });
    }
    refreshAll();
    return { ok: true, message: approve ? "Approved — the school has access now" : "Request declined" };
  } catch (error) {
    return failure(error);
  }
}
