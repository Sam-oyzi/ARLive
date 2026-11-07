"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useState } from "react";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { useI18n } from "@/lib/i18n/client";
import { logout } from "@/server/actions/auth";

export function StudentMenu({ name, username, school }: { name: string; username: string; school: string }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Dropdown>
        <DropdownTrigger className="rounded-full ring-offset-2 transition hover:ring-2 hover:ring-brand-200" aria-label={t.header.account}>
          <Avatar name={name} />
        </DropdownTrigger>
        <DropdownContent>
          <DropdownLabel>
            <span className="block text-sm font-semibold text-ink-900">{name}</span>
            <span className="block font-normal">
              {username} · {school}
            </span>
          </DropdownLabel>
          <DropdownSeparator />
          <DropdownItem onSelect={() => setChangingPassword(true)}>
            <KeyRound /> {t.header.changePassword}
          </DropdownItem>
          <DropdownItem danger onSelect={() => logout()}>
            <LogOut /> {t.header.signOut}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
    </>
  );
}
