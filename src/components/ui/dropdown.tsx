"use client";

import { DropdownMenu as Menu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dropdown = Menu.Root;
export const DropdownTrigger = Menu.Trigger;

export function DropdownContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-48 rounded-2xl border border-ink-200/70 bg-white p-1.5 shadow-lift data-[state=open]:animate-fade-up"
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownItem({
  className,
  danger,
  ...props
}: ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 outline-none select-none data-[highlighted]:bg-ink-100 data-[highlighted]:text-ink-900 [&_svg]:size-4 [&_svg]:text-ink-400",
        danger && "text-rose-600 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-700 [&_svg]:text-rose-400",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownSeparator() {
  return <Menu.Separator className="my-1 h-px bg-ink-100" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="px-3 pt-1.5 pb-1 text-xs font-semibold text-ink-400">{children}</Menu.Label>;
}
