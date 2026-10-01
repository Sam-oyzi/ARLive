"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, FormError, Input } from "@/components/ui/form";
import { joinSchool } from "@/server/actions/auth";

export function JoinForm({ code }: { code?: string }) {
  const [state, action] = useActionState(joinSchool, undefined);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];
  // React resets the form after each submit; refill it from what the server echoed back.
  const typed = (key: string) => state?.values?.[key];

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label="School code" htmlFor="joinCode" error={err("joinCode")}>
        <Input
          id="joinCode"
          name="joinCode"
          defaultValue={typed("joinCode") ?? code}
          required
          autoCapitalize="characters"
          placeholder="Code from your teacher"
          className="h-11 font-mono tracking-[0.2em] uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
        />
      </Field>
      <Field label="Full name" htmlFor="name" error={err("name")}>
        <Input id="name" name="name" defaultValue={typed("name")} required autoComplete="name" className="h-11" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username" htmlFor="username" error={err("username")}>
          <Input id="username" name="username" defaultValue={typed("username")} required autoCapitalize="none" autoComplete="username" className="h-11" />
        </Field>
        <Field label="Class / grade" htmlFor="grade">
          <Input id="grade" name="grade" defaultValue={typed("grade")} placeholder="Optional" className="h-11" />
        </Field>
      </div>
      <Field label="Password" htmlFor="password" error={err("password")} hint="At least 6 characters">
        <Input id="password" name="password" type="password" required autoComplete="new-password" className="h-11" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingText="Creating account…">
        Create my account
      </SubmitButton>
    </form>
  );
}
