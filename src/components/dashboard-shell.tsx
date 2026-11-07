"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { I18nProvider } from "@/lib/i18n/client";
import { Dialog as Sheet } from "radix-ui";
import {
  BookOpen,
  ChartColumn,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Inbox,
  KeyRound,
  Library,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Shapes,
  Sparkles,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { logout } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: string; exact?: boolean };

const NAV: Record<"admin" | "school", { title: string; items: NavItem[] }[]> = {
  admin: [
    {
      title: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/admin/stories", label: "Story requests", icon: Sparkles, badgeKey: "stories" },
      ],
    },
    {
      title: "Studio",
      items: [
        { href: "/admin/books", label: "Books & AR pages", icon: BookOpen },
        { href: "/admin/subjects", label: "Categories", icon: Shapes },
      ],
    },
    {
      title: "People",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/readers", label: "Reader access", icon: UserCheck, badgeKey: "readers" },
        { href: "/admin/schools", label: "Schools", icon: School },
        { href: "/admin/requests", label: "School access", icon: Inbox, badgeKey: "requests" },
      ],
    },
  ],
  school: [
    {
      title: "My school",
      items: [
        { href: "/school", label: "Overview", icon: ChartColumn, exact: true },
        { href: "/school/students", label: "Students", icon: Users },
        { href: "/school/catalog", label: "Book catalog", icon: Library, badgeKey: "requests" },
      ],
    },
  ],
};

type ShellUser = { name: string; username: string; roleLabel: string };

function isActive(item: NavItem, pathname: string) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

function Nav({ area, badges, onNavigate }: { area: "admin" | "school"; badges: Record<string, number>; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace navigation" className="flex flex-col gap-6">
      {NAV[area].map((section) => (
        <div key={section.title}>
          <div className="mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase">{section.title}</div>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(item, pathname);
              const badge = item.badgeKey ? badges[item.badgeKey] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                      active ? "bg-brand-50 text-brand-800 ring-1 ring-brand-100" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                    )}
                  >
                    <item.icon className={cn("size-[18px]", active ? "text-brand-500" : "text-ink-400 group-hover:text-ink-600")} />
                    <span className="flex-1">{item.label}</span>
                    {badge ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ user, context }: { user: ShellUser; context?: ReactNode }) {
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <>
      <Dropdown>
        <DropdownTrigger className="flex w-full items-center gap-3 rounded-2xl border border-ink-200/70 bg-white p-2 text-left shadow-soft transition hover:border-ink-300">
          <Avatar name={user.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink-900">{user.name}</span>
            <span className="block truncate text-xs text-ink-500">{user.roleLabel}</span>
          </span>
          <ChevronDown aria-hidden="true" className="mr-1 size-4 shrink-0 text-ink-500" />
        </DropdownTrigger>
        <DropdownContent align="start">
          <DropdownLabel>{user.username}</DropdownLabel>
          {context}
          <DropdownSeparator />
          <DropdownItem onSelect={() => setChangingPassword(true)}>
            <KeyRound /> Change password
          </DropdownItem>
          <DropdownItem danger onSelect={() => logout()}>
            <LogOut /> Sign out
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
    </>
  );
}

export function DashboardShell({
  area,
  user,
  badges = {},
  header,
  children,
}: {
  area: "admin" | "school";
  user: ShellUser;
  badges?: Record<string, number>;
  /** Shown above the nav (e.g. the school's name). */
  header?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const workspace = /^\/admin\/books\/[^/]+\/targets\//.test(pathname);
  const currentSection = NAV[area].flatMap((section) => section.items).find((item) => isActive(item, pathname));
  const workspaceName = area === "admin" ? "Admin studio" : "School workspace";

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="space-y-3 px-2">
        <Logo href={area === "admin" ? "/admin" : "/school"} />
        <span className="inline-flex rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-600">{workspaceName}</span>
      </div>
      {header}
      <div className="flex-1 overflow-y-auto">
        <Nav area={area} badges={badges} onNavigate={() => setOpen(false)} />
      </div>
      <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-500 hover:bg-ink-50 hover:text-ink-900">
        <ExternalLink aria-hidden="true" className="size-4" /> View the library
      </Link>
      <UserMenu user={user} />
    </div>
  );

  return (
    // The admin studio and school workspace are in English for now, whatever the public site's language:
    // marked so, and handed English words for the shared dialogs and menus inside them.
    <I18nProvider locale="en">
    <div lang="en" dir="ltr" className="min-h-dvh lg:pl-[272px]">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 hidden w-[272px] border-r border-ink-200/70 bg-white lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-200/70 bg-white/85 px-4 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Logo href={area === "admin" ? "/admin" : "/school"} />
          {currentSection && <><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-400" /><span className="truncate text-sm font-medium text-ink-600">{currentSection.label}</span></>}
        </div>
        <Sheet.Root open={open} onOpenChange={setOpen}>
          <Sheet.Trigger className="grid size-10 place-items-center rounded-xl text-ink-700 hover:bg-ink-100" aria-label="Open menu">
            <Menu className="size-5" />
          </Sheet.Trigger>
          <Sheet.Portal>
            <Sheet.Overlay className="fixed inset-0 z-40 bg-ink-950/30 backdrop-blur-[2px]" />
            <Sheet.Content className="fixed inset-y-0 left-0 z-50 w-[min(290px,90vw)] bg-white shadow-lift data-[state=open]:animate-[fade-up_0.25s_ease-out]">
              <Sheet.Title className="sr-only">Navigation</Sheet.Title>
              <Sheet.Description className="sr-only">Main menu</Sheet.Description>
              <Sheet.Close className="absolute top-5 right-4 grid size-8 place-items-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Close menu">
                <X className="size-4" />
              </Sheet.Close>
              {sidebar}
            </Sheet.Content>
          </Sheet.Portal>
        </Sheet.Root>
      </header>

      <main
        id="workspace-content"
        tabIndex={-1}
        className={cn(
          "w-full",
          // The 3D scene editor is a workspace: use the whole screen instead of the reading column.
          workspace ? "px-4 py-4 sm:px-6" : "mx-auto max-w-[1280px] px-4 py-8 sm:px-8 lg:py-10",
        )}
      >
        {children}
      </main>
    </div>
    </I18nProvider>
  );
}
