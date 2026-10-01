"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { createUser } from "@/server/actions/users";

export function UserDialog({ schools }: { schools: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("STUDENT");
  const [state, action] = useActionState(createUser, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> New user
        </Button>
      </DialogTrigger>
      <DialogContent title="New user" description="Create a platform admin, school admin or student account.">
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state?.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" htmlFor="role">
              <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {role !== "SUPER_ADMIN" && (
              <Field label="School" htmlFor="schoolId">
                <Select id="schoolId" name="schoolId" required>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <Field label="Full name" htmlFor="u-name">
            <Input id="u-name" name="name" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={role === "STUDENT" ? "Username" : "Email"} htmlFor="u-username">
              <Input id="u-username" name="username" required autoComplete="off" />
            </Field>
            {role === "STUDENT" ? (
              <Field label="Class / grade" htmlFor="u-grade">
                <Input id="u-grade" name="grade" />
              </Field>
            ) : (
              <div />
            )}
          </div>
          <Field label="Temporary password" htmlFor="u-password">
            <Input id="u-password" name="password" required minLength={6} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create user</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
