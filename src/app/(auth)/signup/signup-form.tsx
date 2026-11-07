"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, FormError, Input } from "@/components/ui/form";
import { signUp } from "@/server/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];
  const { t } = useI18n();
  const u = t.auth.signup;

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state?.error} />
      <Field label={u.name} htmlFor="name" error={err("name")}>
        <Input id="name" name="name" defaultValue={state?.values?.name} required autoComplete="name" autoFocus className="h-11" />
      </Field>
      <Field label={u.email} htmlFor="email" error={err("email")}>
        <Input id="email" name="email" type="email" defaultValue={state?.values?.email} required autoComplete="email" autoCapitalize="none" className="h-11" />
      </Field>
      <Field label={u.password} htmlFor="password" error={err("password")} hint={u.hint}>
        <Input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="h-11" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingText={u.pending}>
        {u.submit}
      </SubmitButton>
      <p className="text-center text-xs text-ink-400">{u.free}</p>
    </form>
  );
}
