"use client";

import { Direction } from "radix-ui";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, localeDir, type Locale } from "./config";
import { messages, type Messages } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Hands the page's language to client components, and its direction to menus and dialogs. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <LocaleContext.Provider value={locale}>
      <Direction.Provider dir={localeDir(locale)}>{children}</Direction.Provider>
    </LocaleContext.Provider>
  );
}

export function useI18n(): { locale: Locale; t: Messages } {
  const locale = useContext(LocaleContext);
  return { locale, t: messages[locale] };
}
