"use client";

import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/form";
import { runAction } from "@/lib/action-client";
import { deleteChild, saveChild, updateProfile } from "@/server/actions/account";
import { cancelStoryRequest } from "@/server/actions/stories";

type Child = { id: string; name: string; age: number | null; interests: string | null };

export function ChildDialog({ child, children }: { child?: Child; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={child ? `Edit ${child.name}` : "Add a child"} description="A first name or nickname is enough. We use this to personalise their stories.">
        <ChildForm child={child} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Inside the dialog so each opening starts fresh.
function ChildForm({ child, onDone }: { child?: Child; onDone: () => void }) {
  const [state, action] = useActionState(saveChild, undefined);
  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message);
    onDone();
  }, [state, onDone]);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];

  return (
    <form action={action} className="flex flex-col gap-4">
      {child && <input type="hidden" name="id" value={child.id} />}
      <FormError message={state?.error} />
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Field label="First name or nickname" htmlFor="child-name" error={err("name")}>
          <Input id="child-name" name="name" required maxLength={40} defaultValue={child?.name} autoFocus />
        </Field>
        <Field label="Age" htmlFor="child-age" error={err("age")}>
          <Input id="child-age" name="age" type="number" min={0} max={14} defaultValue={child?.age ?? ""} />
        </Field>
      </div>
      <Field label="Things they love" htmlFor="child-interests" hint="Optional: animals, colours, hobbies, a favourite toy…">
        <Input id="child-interests" name="interests" maxLength={300} defaultValue={child?.interests ?? ""} />
      </Field>
      <SubmitButton className="mt-1 w-full" pendingText="Saving…">
        {child ? "Save" : "Add child"}
      </SubmitButton>
    </form>
  );
}

export function AddChildButton() {
  return (
    <ChildDialog>
      <Button variant="outline" size="sm">
        <Plus /> Add a child
      </Button>
    </ChildDialog>
  );
}

export function ChildActions({ child }: { child: Child }) {
  const [removing, setRemoving] = useState(false);
  return (
    <div className="flex gap-1">
      <ChildDialog child={child}>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${child.name}`}>
          <Pencil />
        </Button>
      </ChildDialog>
      <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove ${child.name}`} onClick={() => setRemoving(true)}>
        <Trash2 />
      </Button>
      <Confirm
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${child.name}?`}
        description="Their profile is deleted. Stories already made for them stay in your account."
        confirmLabel="Remove"
        onConfirm={() => runAction(deleteChild(child.id))}
      />
    </div>
  );
}

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setConfirming(true)}>
        Withdraw
      </Button>
      <Confirm
        open={confirming}
        onOpenChange={setConfirming}
        title="Withdraw this request?"
        description="We haven't started writing it yet, so nothing is lost. You can always ask again."
        confirmLabel="Withdraw"
        onConfirm={() => runAction(cancelStoryRequest(requestId))}
      />
    </>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  const [changingPassword, setChangingPassword] = useState(false);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);

  return (
    <>
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label="Your name" htmlFor="profile-name" error={state?.fieldErrors?.name?.[0]}>
        <Input id="profile-name" name="name" required maxLength={80} defaultValue={name} />
      </Field>
      <Field label="Email" htmlFor="profile-email" hint="You sign in with this email.">
        <Input id="profile-email" value={email} readOnly disabled />
      </Field>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => setChangingPassword(true)}>
          <KeyRound /> Change password
        </Button>
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
    {/* Outside the form: its own form must not be nested in this one. */}
    <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
    </>
  );
}
