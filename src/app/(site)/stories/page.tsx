import type { Metadata } from "next";
import { BookHeart, Lock, MessageCircleHeart, PenLine, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/roles";
import { STORY_GOALS } from "@/lib/stories";
import { StoryRequestForm } from "./story-request-form";

export const metadata: Metadata = {
  title: "Custom stories",
  description: "Ask for an illustrated story starring your child, about something you'd like them to learn.",
};

const STEPS = [
  { icon: PenLine, title: "Tell us about your child", text: "Their name, age and favourite things, and the lesson you have in mind." },
  { icon: Sparkles, title: "We write and illustrate it", text: "Our story team turns it into a picture book, with AR pages that pop out in 3D." },
  { icon: BookHeart, title: "Read it together", text: "It appears in your account, ready to read on any screen or to order as a printed book." },
];

export default async function StoriesPage() {
  const user = await getCurrentUser();
  const isParent = user?.role === "PARENT";
  const kids = isParent
    ? await db.child.findMany({ where: { parentId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, age: true, interests: true } })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-800">
            <Sparkles aria-hidden="true" className="size-3.5" /> Custom stories
          </span>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold tracking-tight text-ink-900 sm:text-5xl">
            A story about <span className="text-brand-600">your</span> child, with the lesson <span className="text-teal-600">you</span> choose
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-600">
            Children listen differently when they&apos;re the hero. A story about a brave little girl who is scared of the dark, or a boy who
            learns that sharing makes friends, gives them something to think about and gives you a gentle way to talk about it.
          </p>

          <ol className="mt-10 flex flex-col gap-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft ring-1 ring-[#eadfca]">
                  <step.icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="font-display font-bold text-ink-900">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-[15px] text-ink-500">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <p className="text-sm font-semibold text-ink-700">Families often ask for stories about</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {Object.values(STORY_GOALS)
                .filter((g) => g.label !== "Something else")
                .map((goal) => (
                  <li key={goal.label} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink-600 ring-1 ring-[#eadfca]">
                    <span aria-hidden="true">{goal.emoji}</span> {goal.label}
                  </li>
                ))}
            </ul>
          </div>
        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-lift ring-1 ring-[#eadfca] sm:p-8">
          {isParent ? (
            <>
              <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
                <MessageCircleHeart aria-hidden="true" className="size-6 text-rose-500" /> Ask for a story
              </h2>
              <StoryRequestForm kids={kids} />
            </>
          ) : user ? (
            <div className="py-10 text-center">
              <Lock aria-hidden="true" className="mx-auto size-8 text-ink-300" />
              <h2 className="mt-4 font-display text-xl font-bold text-ink-900">Custom stories are for family accounts</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
                You&apos;re signed in as {user.username}. Sign out and create a free parent account to ask for a story.
              </p>
              <ButtonLink href={homeFor(user.role)} variant="outline" className="mt-6">
                Back to my workspace
              </ButtonLink>
            </div>
          ) : (
            <div className="py-6 text-center sm:py-10">
              <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-500">
                <BookHeart aria-hidden="true" className="size-8" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink-900">Start with a free account</h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-500">
                Your account keeps your children&apos;s profiles, your requests and the finished stories in one private place.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href="/signup?next=/stories" size="lg">
                  Create a free account
                </ButtonLink>
                <ButtonLink href="/login?next=/stories" size="lg" variant="outline">
                  I already have one
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
