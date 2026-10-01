"use client";

import { Check, MoreHorizontal, Pause, Play, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Field, FormError, Input } from "@/components/ui/form";
import { runAction } from "@/lib/action-client";
import { decideRequest } from "@/server/actions/requests";
import { createSchoolAdmin, deleteSchool, regenerateJoinCode, setSchoolActive } from "@/server/actions/schools";

export function SchoolMenu({ schoolId, name, active }: { schoolId: string; name: string; active: boolean }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => runAction(setSchoolActive(schoolId, !active))}>
            {active ? <Pause /> : <Play />} {active ? "Pause school" : "Reactivate school"}
          </DropdownItem>
          <DropdownItem onSelect={() => runAction(regenerateJoinCode(schoolId))}>
            <RefreshCw /> New join code
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem danger onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete school
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <Confirm
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${name}?`}
        description="All of its admins, students and scan history will be permanently deleted."
        onConfirm={async () => {
          const result = await runAction(deleteSchool(schoolId));
          if (result?.ok) router.push("/admin/schools");
        }}
      />
    </>
  );
}

export function AddAdminDialog({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createSchoolAdmin, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="soft" size="sm">
          <UserPlus /> Add admin
        </Button>
      </DialogTrigger>
      <DialogContent title="Add a school admin" description="They can manage students and request books for this school.">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="schoolId" value={schoolId} />
          <FormError message={state?.error} />
          <Field label="Full name" htmlFor="admin-name">
            <Input id="admin-name" name="name" required />
          </Field>
          <Field label="Email (used to sign in)" htmlFor="admin-email">
            <Input id="admin-email" name="username" type="email" required autoComplete="off" />
          </Field>
          <Field label="Temporary password" htmlFor="admin-password" hint="Share it privately; at least 8 characters.">
            <Input id="admin-password" name="password" type="text" required minLength={8} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create admin</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RequestDecision({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1.5">
      <Button size="xs" variant="outline" disabled={pending} onClick={() => start(() => runAction(decideRequest(requestId, false)).then(() => {}))}>
        <X /> Decline
      </Button>
      <Button size="xs" disabled={pending} onClick={() => start(() => runAction(decideRequest(requestId, true)).then(() => {}))}>
        <Check /> Approve
      </Button>
    </div>
  );
}
