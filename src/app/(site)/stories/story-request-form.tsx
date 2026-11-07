"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { STORY_GOALS, STORY_LANGUAGES, type StoryGoal } from "@/lib/stories";
import { useI18n } from "@/lib/i18n/client";
import { languageName } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { createStoryRequest } from "@/server/actions/stories";

type Child = { id: string; name: string; age: number | null; interests: string | null };

export function StoryRequestForm({ kids, defaultLanguage }: { kids: Child[]; defaultLanguage: string }) {
  const { locale, t } = useI18n();
  const f = t.stories.form;
  const [state, action] = useActionState(createStoryRequest, undefined);
  const [childId, setChildId] = useState(kids[0]?.id ?? "");
  const [goal, setGoal] = useState<StoryGoal | "">("");
  const router = useRouter();
  const child = kids.find((k) => k.id === childId);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message);
    router.push("/account#stories");
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <FormError message={state?.error} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-display text-lg font-bold text-ink-900">{f.who}</legend>
        {kids.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {[...kids, { id: "", name: f.someoneElse, age: null, interests: null }].map((k) => (
              <button
                key={k.id || "new"}
                type="button"
                onClick={() => setChildId(k.id)}
                aria-pressed={childId === k.id}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  childId === k.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                )}
              >
                {k.name}
                {k.age != null && <span className="font-medium text-ink-400"> · {k.age}</span>}
              </button>
            ))}
          </div>
        )}
        <input type="hidden" name="childId" value={childId} />
        {/* key: switching child refills the fields from their profile */}
        <div key={childId} className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label={f.childName} htmlFor="childName" error={err("childName")} hint={f.childNameHint}>
            <Input id="childName" name="childName" required maxLength={40} defaultValue={child?.name ?? state?.values?.childName} placeholder={f.childNamePlaceholder} />
          </Field>
          <Field label={f.age} htmlFor="childAge" error={err("childAge")}>
            <Input id="childAge" name="childAge" type="number" min={0} max={14} defaultValue={child?.age ?? state?.values?.childAge} placeholder="5" />
          </Field>
          <Field label={f.loves} htmlFor="interests" hint={f.lovesHint} className="sm:col-span-2">
            <Input id="interests" name="interests" maxLength={300} defaultValue={child?.interests ?? state?.values?.interests} placeholder={f.lovesPlaceholder} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-lg font-bold text-ink-900">{f.helpWith}</legend>
        <div role="radiogroup" aria-label={f.goal} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(STORY_GOALS) as StoryGoal[]).map((key) => (
            <label
              key={key}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300",
                goal === key ? "border-brand-500 bg-brand-50 text-brand-800" : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
              )}
            >
              <input type="radio" name="goal" value={key} required checked={goal === key} onChange={() => setGoal(key)} className="sr-only" />
              <span aria-hidden="true" className="text-lg">{STORY_GOALS[key].emoji}</span>
              {t.stories.goals[key]}
            </label>
          ))}
        </div>
        {err("goal") && <p className="mt-2 text-xs font-medium text-rose-600">{err("goal")}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-display text-lg font-bold text-ink-900">{f.ownWords}</legend>
        <Field
          label={f.learn}
          htmlFor="message"
          error={err("message")}
          hint={f.learnHint}
        >
          <Textarea
            id="message"
            name="message"
            required
            minLength={10}
            maxLength={1500}
            defaultValue={state?.values?.message}
            className="min-h-32"
            placeholder={f.learnPlaceholder}
          />
        </Field>
        <Field label={f.language} htmlFor="language" className="sm:max-w-xs">
          <Select id="language" name="language" defaultValue={state?.values?.language ?? defaultLanguage}>
            {STORY_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {languageName(locale, code)}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-[#eadfca] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-500">{f.privacy}</p>
        <SubmitButton size="lg" pendingText={f.sending}>
          {f.send}
        </SubmitButton>
      </div>
    </form>
  );
}
