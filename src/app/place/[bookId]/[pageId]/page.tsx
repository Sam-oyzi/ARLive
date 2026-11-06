import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { DirectModelExperience } from "@/components/direct-model-experience";
import { getCurrentUser } from "@/lib/auth";
import { requireReadableBook } from "@/lib/books";
import type { ContentData } from "@/lib/content";
import { db } from "@/lib/db";
import { soundLayers } from "@/lib/sound-layers";
import { bookReturnHref, readerHref, withReturnTo } from "@/lib/reader-navigation";
import { opensModel, placementModel } from "@/lib/scan-actions";

export const metadata: Metadata = { title: "Place model" };
export const viewport: Viewport = { themeColor: "#000000", maximumScale: 1, userScalable: false };

export default async function PlacePage({ params, searchParams }: {
  params: Promise<{ bookId: string; pageId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ bookId, pageId }, { returnTo }] = await Promise.all([params, searchParams]);
  const backHref = bookReturnHref(bookId, returnTo, readerHref(bookId, pageId));
  await requireReadableBook(await getCurrentUser(), bookId, withReturnTo(`/place/${bookId}/${pageId}`, backHref));
  const target = await db.target.findFirst({ where: { id: pageId, bookId }, include: { contents: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] }, sounds: { where: { kind: "scene" }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] } } });
  const model = target && placementModel(target.contents);
  if (!target || !opensModel(target.scanAction) || !model) notFound();
  return <DirectModelExperience key={`${target.id}:${target.scanAction}`} engine={target.scanAction as "quicklook" | "eighthwall"} content={model as ContentData} title={target.name} sounds={soundLayers(target.sounds)} backHref={backHref} />;
}
