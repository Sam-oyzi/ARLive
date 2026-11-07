"use client";

import Link from "next/link";
import { BookHeart, KeyRound, LayoutDashboard, LogOut } from "lucide-react";
import { useState } from "react";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { useI18n } from "@/lib/i18n/client";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { logout } from "@/server/actions/auth";

/** The signed-in user's menu on public pages: their own area, password and sign out. */
export function AccountMenu({ name, username, home, homeLabel }: { name: string; username: string; home: string; homeLabel: string }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const { t } = useI18n();
  const isAccount = home === "/account";

  return (
    <>
      <Dropdown modal={false}>
        <DropdownTrigger className="flex items-center gap-2 rounded-full p-0.5 pe-1 ring-offset-2 transition hover:ring-2 hover:ring-brand-200 sm:pe-3" aria-label={t.header.accountMenu}>
          <Avatar name={name} className="size-9" />
          <span className="hidden max-w-32 truncate text-sm font-semibold text-ink-800 sm:block">{name.split(" ")[0]}</span>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownLabel>
            <span className="block text-sm font-semibold text-ink-900">{name}</span>
            <span className="block font-normal">{username}</span>
          </DropdownLabel>
          <DropdownSeparator />
          <DropdownItem asChild>
            <Link href={home}>
              {isAccount ? <BookHeart /> : <LayoutDashboard />} {homeLabel}
            </Link>
          </DropdownItem>
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
