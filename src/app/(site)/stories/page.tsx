import type { Metadata } from "next";
import { BookHeart, Lock, MessageCircleHeart, PenLine, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/roles";
import { STORY_GOALS, type StoryGoal } from "@/lib/stories";
import { getI18n } from "@/lib/i18n/server";
import { StoryRequestForm } from "./story-request-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.stories, description: t.meta.storiesDescription };
}

const STEP_ICONS = [PenLine, Sparkles, BookHeart];

export default async function StoriesPage() {
  const [user, { locale, t }] = await Promise.all([getCurrentUser(), getI18n()]);
  const w = t.stories;
  const isParent = user?.role === "PARENT";
  const kids = isParent
    ? await db.child.findMany({ where: { parentId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, age: true, interests: true } })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-800">
            <Sparkles aria-hidden="true" className="size-3.5" /> {w.badge}
          </span>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold tracking-tight text-ink-900 sm:text-5xl">
            {w.titleA}<span className="text-brand-600">{w.titleB}</span>{w.titleC}<span className="text-teal-600">{w.titleD}</span>{w.titleE}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-600">{w.intro}</p>

          <ol className="mt-10 flex flex-col gap-5">
            {w.steps.map((step, i) => {
              const Icon = STEP_ICONS[i]!;
              return (
              <li key={step.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft ring-1 ring-[#eadfca]">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="font-display font-bold text-ink-900">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-[15px] text-ink-500">{step.text}</p>
                </div>
              </li>
              );
            })}
          </ol>

          <div className="mt-10">
            <p className="text-sm font-semibold text-ink-700">{w.oftenAsk}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(STORY_GOALS) as StoryGoal[])
                .filter((key) => key !== "other")
                .map((key) => (
                  <li key={key} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink-600 ring-1 ring-[#eadfca]">
                    <span aria-hidden="true">{STORY_GOALS[key].emoji}</span> {w.goals[key]}
                  </li>
                ))}
            </ul>
          </div>
        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-lift ring-1 ring-[#eadfca] sm:p-8">
          {isParent ? (
            <>
              <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
                <MessageCircleHeart aria-hidden="true" className="size-6 text-rose-500" /> {w.askForStory}
              </h2>
              <StoryRequestForm kids={kids} defaultLanguage={locale} />
            </>
          ) : user ? (
            <div className="py-10 text-center">
              <Lock aria-hidden="true" className="mx-auto size-8 text-ink-300" />
              <h2 className="mt-4 font-display text-xl font-bold text-ink-900">{w.familyOnlyTitle}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">{w.familyOnlyText(user.username)}</p>
              <ButtonLink href={homeFor(user.role)} variant="outline" className="mt-6">
                {w.backWorkspace}
              </ButtonLink>
            </div>
          ) : (
            <div className="py-6 text-center sm:py-10">
              <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-500">
                <BookHeart aria-hidden="true" className="size-8" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink-900">{w.startTitle}</h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-500">{w.startText}</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href="/signup?next=/stories" size="lg">
                  {w.createAccount}
                </ButtonLink>
                <ButtonLink href="/login?next=/stories" size="lg" variant="outline">
                  {w.haveOne}
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
