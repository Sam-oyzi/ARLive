// The languages the site itself speaks (books carry their own translations, see page-translations).
// French is the default; a visitor's choice is kept in a cookie so every page, server or client,
// renders in it from the first byte.
export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "pw-lang";
/** A year: the choice should outlive a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Each language in its own words, for the switcher. */
export const LOCALE_NAME: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };
/** A short tag for the switcher's button when space is tight. */
export const LOCALE_SHORT: Record<Locale, string> = { fr: "FR", en: "EN", ar: "ع" };

/**
 * The locale handed to Intl for numbers, dates and plural rules. Arabic keeps Western digits
 * (1, 2, 3), as most readers across North Africa and the web expect, while its grammar (duals,
 * plural classes) still follows Arabic rules.
 */
export const INTL_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", ar: "ar-u-nu-latn" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** The locale named by a cookie value, or the default. */
export function localeFrom(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
