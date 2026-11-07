"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/form";
import { changePassword } from "@/server/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t.password.title} description={t.password.text}>
        <ChangePasswordForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

// Lives inside the dialog so every opening starts with an empty form and no old error.
function ChangePasswordForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [state, action] = useActionState(changePassword, undefined);
  const { t } = useI18n();

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label={t.password.current} htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required autoFocus />
      </Field>
      <Field label={t.password.new} htmlFor="newPassword" hint={t.password.hint}>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <SubmitButton className="mt-1 w-full" pendingText={t.common.saving}>
        {t.password.change}
      </SubmitButton>
    </form>
  );
}
