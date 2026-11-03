"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/form";
import { changePassword } from "@/server/actions/auth";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Change password" description="Your other devices will be signed out.">
        <ChangePasswordForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

// Lives inside the dialog so every opening starts with an empty form and no old error.
function ChangePasswordForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [state, action] = useActionState(changePassword, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label="Current password" htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required autoFocus />
      </Field>
      <Field label="New password" htmlFor="newPassword" hint="At least 8 characters">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <SubmitButton className="mt-1 w-full" pendingText="Saving…">
        Change password
      </SubmitButton>
    </form>
  );
}
