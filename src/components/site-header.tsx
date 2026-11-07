import Link from "next/link";
import { Library, Sparkles, UserRound } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { BasketLink } from "@/components/basket/basket-link";
import { Logo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { homeFor } from "@/lib/roles";

export async function SiteHeader() {
  const [user, { t }] = await Promise.all([getCurrentUser(), getI18n()]);
  const nav = [
    { href: "/library", label: t.common.library, icon: Library },
    { href: "/stories", label: t.header.customStories, icon: Sparkles },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-[#eadfca]/80 bg-[#fbf7ef]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Logo className="gap-2 sm:gap-2.5" />
        <nav aria-label={t.header.mainNav} className="ms-2 hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink-600 transition hover:bg-white/70 hover:text-ink-900">
              <item.icon aria-hidden="true" className="size-4" /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          {/* Phones and tablets have it in the row below, where there's room. */}
          <LanguageSwitcher className="hidden lg:flex" />
          <BasketLink />
          {user ? (
            <AccountMenu name={user.name} username={user.username} home={homeFor(user.role)} homeLabel={t.header.home[user.role] ?? t.header.home.PARENT!} />
          ) : (
            <>
              {/* Phones: an account icon, so the longer French and Arabic labels still fit in one row. */}
              <ButtonLink href="/login" variant="ghost" size="sm" aria-label={t.header.signIn} className="w-9 px-0 sm:w-auto sm:px-3">
                <UserRound aria-hidden="true" className="!size-5 sm:hidden" />
                <span className="hidden sm:inline">{t.header.signIn}</span>
              </ButtonLink>
              <ButtonLink href="/signup" size="sm" className="px-2.5 sm:px-3">
                {t.header.join}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
      {/* Phones and tablets get the two destinations as a second row instead of a menu, and the language beside them. */}
      <nav aria-label={t.header.mainNav} className="mx-auto flex max-w-6xl gap-1 px-3 pb-2 lg:hidden">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-[#eadfca]">
            <item.icon aria-hidden="true" className="size-4 shrink-0" /> <span className="truncate">{item.label}</span>
          </Link>
        ))}
        <LanguageSwitcher className="h-auto bg-white/70 ring-1 ring-[#eadfca]" />
      </nav>
    </header>
  );
}

export async function SiteFooter() {
  const { t } = await getI18n();
  return (
    <footer className="border-t border-[#eadfca] bg-[#f6efe1]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">{t.footer.blurb}</p>
          <LanguageSwitcher full className="-ms-2 mt-3" />
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-ink-900">{t.footer.read}</span>
          <Link href="/library" className="text-ink-600 hover:text-ink-900">{t.common.library}</Link>
          <Link href="/library?sort=rating" className="text-ink-600 hover:text-ink-900">{t.footer.topRated}</Link>
          <Link href="/library?sort=new" className="text-ink-600 hover:text-ink-900">{t.footer.newStories}</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-ink-900">{t.footer.families}</span>
          <Link href="/stories" className="text-ink-600 hover:text-ink-900">{t.footer.askCustom}</Link>
          <Link href="/signup" className="text-ink-600 hover:text-ink-900">{t.footer.createAccount}</Link>
          <Link href="/join" className="text-ink-600 hover:text-ink-900">{t.footer.schoolCode}</Link>
        </div>
      </div>
      <p className="border-t border-[#eadfca] py-5 text-center text-xs text-ink-400">© {new Date().getFullYear()} PageWakes · {t.common.tagline}</p>
    </footer>
  );
}
