import Link from "next/link";
import { Library, Sparkles } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

const HOME_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Admin studio",
  SCHOOL_ADMIN: "School dashboard",
  STUDENT: "My school books",
  PARENT: "My account",
};

const NAV = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/stories", label: "Custom stories", icon: Sparkles },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-[#eadfca]/80 bg-[#fbf7ef]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-white/70 hover:text-ink-900">
              <item.icon aria-hidden="true" className="size-4" /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <AccountMenu name={user.name} username={user.username} home={homeFor(user.role)} homeLabel={HOME_LABEL[user.role] ?? "My account"} />
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                Join free
              </ButtonLink>
            </>
          )}
        </div>
      </div>
      {/* Phones get the two destinations as a second row instead of a menu. */}
      <nav aria-label="Main" className="mx-auto flex max-w-6xl gap-1 px-3 pb-2 md:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-[#eadfca]">
            <item.icon aria-hidden="true" className="size-4" /> {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#eadfca] bg-[#f6efe1]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
            Free illustrated stories for kids. Read on any screen, print at home, and scan the pages to see them come alive.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-ink-900">Read</span>
          <Link href="/library" className="text-ink-600 hover:text-ink-900">Library</Link>
          <Link href="/library?sort=rating" className="text-ink-600 hover:text-ink-900">Top rated</Link>
          <Link href="/library?sort=new" className="text-ink-600 hover:text-ink-900">New stories</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-ink-900">Families</span>
          <Link href="/stories" className="text-ink-600 hover:text-ink-900">Ask for a custom story</Link>
          <Link href="/signup" className="text-ink-600 hover:text-ink-900">Create a free account</Link>
          <Link href="/join" className="text-ink-600 hover:text-ink-900">I have a school code</Link>
        </div>
      </div>
      <p className="border-t border-[#eadfca] py-5 text-center text-xs text-ink-400">© {new Date().getFullYear()} PageWakes · Illustrated stories for kids</p>
    </footer>
  );
}
