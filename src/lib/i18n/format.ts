import { INTL_LOCALE, type Locale } from "./config";

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const rules = new Map<Locale, Intl.PluralRules>();

/**
 * Picks the grammatical form for a count and fills in {n}. Arabic has six classes (zero, one, two,
 * few for 3–10, many for 11–99, other for 100+), French counts 0 and 1 as singular, English only 1.
 */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  let rule = rules.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(INTL_LOCALE[locale]);
    rules.set(locale, rule);
  }
  const form = forms[rule.select(count)] ?? forms.other;
  return form.replaceAll("{n}", formatNumber(locale, count));
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** 1234 → "1.2K" / "1,2 k" / "1.2 ألف", for counters on small cards. */
export function compactNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** "3 days ago" / "il y a 3 jours" / "قبل 3 أيام". */
export function timeAgo(locale: Locale, date: Date | string, justNow: string): string {
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return justNow;
}

/** A language's name in the reader's language ("anglais", "الإنجليزية"). */
export function languageName(locale: Locale, code: string): string {
  const name = new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "language" }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(INTL_LOCALE[locale]) + name.slice(1);
}
