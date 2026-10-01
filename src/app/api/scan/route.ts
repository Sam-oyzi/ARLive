import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canUserOpenBook } from "@/lib/books";
import { db } from "@/lib/db";

const body = z.object({ bookId: z.string().min(1), targetId: z.string().min(1) });

/** Records that a student recognised a page (feeds the dashboards). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { bookId, targetId } = parsed.data;

  if (!(await canUserOpenBook(user, bookId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const target = await db.target.findFirst({ where: { id: targetId, bookId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.scanEvent.create({ data: { userId: user.id, schoolId: user.schoolId, bookId, targetId } });
  return NextResponse.json({ ok: true });
}
