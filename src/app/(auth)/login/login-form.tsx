"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, FormError, Input } from "@/components/ui/form";
import { login } from "@/server/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  const l = t.auth.login;

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state?.error} />
      <Field label={l.username} htmlFor="username">
        <Input id="username" name="username" defaultValue={state?.values?.username} autoComplete="username" autoCapitalize="none" required autoFocus className="h-11" />
      </Field>
      <Field label={l.password} htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-11 pe-11"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 end-0 grid w-11 place-items-center text-ink-400 hover:text-ink-700"
            aria-label={show ? l.hide : l.show}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingText={l.pending}>
        {l.submit}
      </SubmitButton>
    </form>
  );
}
