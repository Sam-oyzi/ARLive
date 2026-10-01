"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, FormError, Input } from "@/components/ui/form";
import { joinSchool } from "@/server/actions/auth";

export function JoinForm({ code }: { code?: string }) {
  const [state, action] = useActionState(joinSchool, undefined);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label="School code" htmlFor="joinCode" error={err("joinCode")}>
        <Input
          id="joinCode"
          name="joinCode"
          defaultValue={code}
          required
          autoCapitalize="characters"
          placeholder="e.g. 7KQ2M9XA"
          className="h-11 font-mono tracking-[0.2em] uppercase"
        />
      </Field>
      <Field label="Full name" htmlFor="name" error={err("name")}>
        <Input id="name" name="name" required autoComplete="name" className="h-11" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username" htmlFor="username" error={err("username")}>
          <Input id="username" name="username" required autoCapitalize="none" autoComplete="username" className="h-11" />
        </Field>
        <Field label="Class / grade" htmlFor="grade">
          <Input id="grade" name="grade" placeholder="Optional" className="h-11" />
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
