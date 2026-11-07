"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, FormError, Input } from "@/components/ui/form";
import { joinSchool } from "@/server/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function JoinForm({ code }: { code?: string }) {
  const [state, action] = useActionState(joinSchool, undefined);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];
  const { t } = useI18n();
  const j = t.auth.join;
  // React resets the form after each submit; refill it from what the server echoed back.
  const typed = (key: string) => state?.values?.[key];

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label={j.code} htmlFor="joinCode" error={err("joinCode")}>
        <Input
          id="joinCode"
          name="joinCode"
          defaultValue={typed("joinCode") ?? code}
          required
          autoCapitalize="characters"
          placeholder={j.codePlaceholder}
          className="h-11 font-mono tracking-[0.2em] uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
        />
      </Field>
      <Field label={j.fullName} htmlFor="name" error={err("name")}>
        <Input id="name" name="name" defaultValue={typed("name")} required autoComplete="name" className="h-11" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={j.username} htmlFor="username" error={err("username")}>
          <Input id="username" name="username" defaultValue={typed("username")} required autoCapitalize="none" autoComplete="username" className="h-11" />
        </Field>
        <Field label={j.grade} htmlFor="grade">
          <Input id="grade" name="grade" defaultValue={typed("grade")} placeholder={t.common.optional} className="h-11" />
        </Field>
      </div>
      <Field label={j.password} htmlFor="password" error={err("password")} hint={j.hint}>
        <Input id="password" name="password" type="password" required autoComplete="new-password" className="h-11" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingText={j.pending}>
        {j.submit}
      </SubmitButton>
    </form>
  );
}
