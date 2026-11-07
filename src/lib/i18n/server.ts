import { cookies } from "next/headers";
import { cache } from "react";
import { LOCALE_COOKIE, localeFrom, type Locale } from "./config";
import { messages, type Messages } from "./messages";

/** The visitor's language for this request (French until they pick another). */
export const getLocale = cache(async (): Promise<Locale> => localeFrom((await cookies()).get(LOCALE_COOKIE)?.value));

/** The visitor's language and its words, for server components, metadata and server actions. */
export async function getI18n(): Promise<{ locale: Locale; t: Messages }> {
  const locale = await getLocale();
  return { locale, t: messages[locale] };
}

/** Words for a server action's reply: the admin studio is in English, everyone else gets their own language. */
export async function wordsFor(role: string): Promise<Messages> {
  return role === "SUPER_ADMIN" ? messages.en : (await getI18n()).t;
}
