"use client";

// Picks the site's language (French, English or Arabic). The choice goes in a cookie, so the server
// renders every page in it; the page then refreshes in place, keeping the visitor where they were.
import { Check, ChevronDown, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAME, LOCALE_SHORT, LOCALES, localeDir, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function chooseLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  // Right away, so the page turns the right way round before the new words arrive.
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDir(locale);
}

export function LanguageSwitcher({ className, full = false }: { className?: string; full?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Dropdown modal={false}>
      <DropdownTrigger
        aria-label={`${t.common.chooseLanguage}: ${LOCALE_NAME[locale]}`}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-ink-600 transition hover:bg-white/70 hover:text-ink-900 data-[state=open]:bg-white/80",
          pending && "opacity-60",
          className,
        )}
      >
        <Languages aria-hidden="true" className="size-4" />
        <span lang={locale}>{full ? LOCALE_NAME[locale] : LOCALE_SHORT[locale]}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
      </DropdownTrigger>
      <DropdownContent className="min-w-40">
        <DropdownLabel>{t.common.chooseLanguage}</DropdownLabel>
        {LOCALES.map((option) => (
          <DropdownItem
            key={option}
            onSelect={() => {
              if (option === locale) return;
              chooseLocale(option);
              start(() => router.refresh());
            }}
            className="justify-between"
          >
            <span lang={option} dir={localeDir(option)}>{LOCALE_NAME[option]}</span>
            {option === locale && <Check aria-hidden="true" className="!text-brand-600" />}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
