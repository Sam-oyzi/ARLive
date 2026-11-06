import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock, Heart, KeyRound, MessageSquareQuote, Smile, Sparkles } from "lucide-react";
import { BookCover, BookGrid } from "@/components/library/book-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { libraryBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { bookCardSelect, toBookCard } from "@/lib/library";
import { goalLabel, languageName, STORY_GOALS, storyStatus, type StoryGoal } from "@/lib/stories";
import { timeAgo } from "@/lib/utils";
import { AddChildButton, CancelRequestButton, ChildActions, ProfileForm } from "./account-bits";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser(["PARENT"]);
  const [kids, requests, likes, shared, waiting] = await Promise.all([
    db.child.findMany({ where: { parentId: user.id }, orderBy: { createdAt: "asc" } }),
    db.storyRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { book: { select: { ...bookCardSelect, published: true } } },
    }),
    db.bookLike.findMany({
      where: { userId: user.id, book: libraryBooksWhere },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { book: { select: bookCardSelect } },
    }),
    db.book.findMany({
      where: { ...libraryBooksWhere, visibility: "APPROVED", readers: { some: { email: user.username, status: "APPROVED" } } },
      orderBy: { title: "asc" },
      select: bookCardSelect,
    }),
    db.bookReader.findMany({
      where: { email: user.username, status: "PENDING", book: libraryBooksWhere },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, book: { select: { id: true, title: true } } },
    }),
  ]);
  const liked = likes.map((l) => toBookCard(l.book));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600">My account</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-ink-900">Hello, {user.name.split(" ")[0]}</h1>
          <p className="mt-2 text-[15px] text-ink-600">Your family&apos;s stories, children and favourite books, all in one place.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/library" variant="outline">
            <BookOpen /> Library
          </ButtonLink>
          <ButtonLink href="/stories">
            <Sparkles /> New custom story
          </ButtonLink>
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* custom stories */}
        <section id="stories" className="scroll-mt-24 rounded-[28px] bg-white p-6 ring-1 ring-[#eadfca] sm:p-7">
          <h2 className="font-display text-xl font-bold text-ink-900">My custom stories</h2>
          {requests.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#fbf7ef] px-5 py-10 text-center">
              <Sparkles aria-hidden="true" className="mx-auto size-7 text-amber-500" />
              <p className="mt-3 font-semibold text-ink-900">No custom stories yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500">Tell us what you&apos;d like your child to learn and we&apos;ll write a story starring them.</p>
              <ButtonLink href="/stories" size="sm" className="mt-5">
                Ask for a story
              </ButtonLink>
            </div>
          ) : (
            <ul className="mt-5 flex flex-col gap-4">
              {requests.map((r) => {
                const status = storyStatus(r.status);
                const ready = r.status === "DELIVERED" && r.book?.published;
                return (
                  <li key={r.id} className="flex gap-4 rounded-2xl border border-[#eadfca] p-4">
                    <div className="w-16 shrink-0">
                      {ready && r.book ? (
                        <Link href={`/read/${r.book.id}`} aria-label={`Read ${r.book.title}`}>
                          <BookCover book={toBookCard(r.book)} sizes={{ width: 64, height: 85 }} className="rounded-xl shadow-soft" />
                        </Link>
                      ) : (
                        <span className="grid aspect-[3/4] place-items-center rounded-xl bg-amber-50 text-2xl" aria-hidden="true">
                          {STORY_GOALS[r.goal as StoryGoal]?.emoji ?? "✨"}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold text-ink-900">{ready && r.book ? r.book.title : `For ${r.childName}`}</span>
                        <Badge tone={status.tone} dot>
                          {status.parentLabel}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {goalLabel(r.goal)} · {languageName(r.language)} · asked {timeAgo(r.createdAt)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-ink-600">“{r.message}”</p>
                      {r.adminNote && (
                        <p className="mt-2 flex gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
                          <MessageSquareQuote aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
                          {r.adminNote}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ready && r.book && (
                          <>
                            <ButtonLink href={`/read/${r.book.id}`} size="sm">
                              <BookOpen /> Read
                            </ButtonLink>
                            <ButtonLink href={`/print/${r.book.id}`} size="sm" variant="outline">
                              Download
                            </ButtonLink>
                          </>
                        )}
                        {r.status === "NEW" && <CancelRequestButton requestId={r.id} />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-8">
          {/* children */}
          <section className="rounded-[28px] bg-white p-6 ring-1 ring-[#eadfca] sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-ink-900">My children</h2>
              <AddChildButton />
            </div>
            {kids.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-ink-500">
                <Smile aria-hidden="true" className="size-4 text-amber-500" /> Add your children to fill in story requests faster.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[#f1e8d6]">
                {kids.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-brand-500 font-display font-bold text-white">
                      {k.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink-900">
                        {k.name}
                        {k.age != null && <span className="font-normal text-ink-500"> · {k.age} years</span>}
                      </p>
                      {k.interests && <p className="truncate text-xs text-ink-500">Loves {k.interests}</p>}
                    </div>
                    <ChildActions child={{ id: k.id, name: k.name, age: k.age, interests: k.interests }} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* profile */}
          <section className="rounded-[28px] bg-white p-6 ring-1 ring-[#eadfca] sm:p-7">
            <h2 className="mb-4 font-display text-xl font-bold text-ink-900">Profile</h2>
            <ProfileForm name={user.name} email={user.username} />
          </section>
        </div>
      </div>

      {/* books shared with this family (bought in print, or approved on request) */}
      {(shared.length > 0 || waiting.length > 0) && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
            <KeyRound aria-hidden="true" className="size-6 text-sky-600" /> Books shared with you
          </h2>
          {waiting.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {waiting.map((w) => (
                <li key={w.id}>
                  <Link href={`/library/${w.book.id}`} className="flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                    <Clock aria-hidden="true" className="size-4" /> {w.book.title}: waiting for approval
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {shared.length > 0 && <BookGrid books={shared.map((b) => toBookCard(b))} className="mt-6" />}
        </section>
      )}

      {/* likes */}
      <section className="mt-12">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
          <Heart aria-hidden="true" className="size-6 text-rose-500" fill="currentColor" strokeWidth={0} /> Books we love
        </h2>
        {liked.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            Tap the heart on any book in the{" "}
            <Link href="/library" className="font-semibold text-brand-600 hover:underline">
              library
            </Link>{" "}
            to keep it here.
          </p>
        ) : (
          <BookGrid books={liked} className="mt-6" />
        )}
      </section>
    </div>
  );
}
