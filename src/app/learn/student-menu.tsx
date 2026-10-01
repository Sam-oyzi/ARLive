"use client";

import { LogOut } from "lucide-react";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { logout } from "@/server/actions/auth";

export function StudentMenu({ name, username, school }: { name: string; username: string; school: string }) {
  return (
    <Dropdown>
      <DropdownTrigger className="rounded-full ring-offset-2 transition hover:ring-2 hover:ring-brand-200" aria-label="Account">
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
        <DropdownItem danger onSelect={() => logout()}>
          <LogOut /> Sign out
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
