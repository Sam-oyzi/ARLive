"use client";

import { Ban, CircleCheck, KeyRound, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { runAction } from "@/lib/action-client";
import { deleteUser, resetPassword, setUserActive } from "@/server/actions/users";
import { useI18n } from "@/lib/i18n/client";

export function UserRowActions({ user }: { user: { id: string; name: string; username: string; active: boolean } }) {
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const { t } = useI18n();
  const d = t.dashboard;

  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={d.actionsFor(user.name)}>
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem
            onSelect={async () => {
              const result = await runAction(resetPassword(user.id));
              if (result?.data) setPassword(result.data.password);
            }}
          >
            <KeyRound /> {d.resetPassword}
          </DropdownItem>
          <DropdownItem onSelect={() => runAction(setUserActive(user.id, !user.active))}>
            {user.active ? <Ban /> : <CircleCheck />} {user.active ? d.disable : d.enable}
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem danger onSelect={() => setDeleting(true)}>
            <Trash2 /> {d.delete}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      <Confirm
        open={deleting}
        onOpenChange={setDeleting}
        title={d.deleteTitle(user.name)}
        description={d.deleteText}
        onConfirm={() => runAction(deleteUser(user.id))}
      />

      <Dialog open={password !== null} onOpenChange={(open) => !open && setPassword(null)}>
        <DialogContent title={d.newPassword} description={d.shareDetails(user.name)}>
          <div className="flex flex-col gap-3 rounded-2xl bg-ink-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-500">{d.username}</span>
              <code className="font-mono font-semibold text-ink-900">{user.username}</code>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-500">{d.password}</span>
              <span className="flex items-center gap-2">
                <code className="font-mono text-base font-bold tracking-wider text-ink-900">{password}</code>
                {password && <CopyButton value={password} />}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
