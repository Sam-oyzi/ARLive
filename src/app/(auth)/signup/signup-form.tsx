"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, FormError, Input } from "@/components/ui/form";
import { signUp } from "@/server/actions/auth";

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state?.error} />
      <Field label="Your name" htmlFor="name" error={err("name")}>
        <Input id="name" name="name" defaultValue={state?.values?.name} required autoComplete="name" autoFocus className="h-11" />
      </Field>
      <Field label="Email" htmlFor="email" error={err("email")}>
        <Input id="email" name="email" type="email" defaultValue={state?.values?.email} required autoComplete="email" autoCapitalize="none" className="h-11" />
      </Field>
      <Field label="Password" htmlFor="password" error={err("password")} hint="At least 8 characters">
        <Input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="h-11" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingText="Creating your account…">
        Create my account
      </SubmitButton>
      <p className="text-center text-xs text-ink-400">Reading the library is free, with or without an account.</p>
    </form>
  );
}
