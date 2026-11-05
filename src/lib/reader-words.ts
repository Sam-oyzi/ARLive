// The few words the reader itself puts on a page, in the book's languages, so a child reading in
// French or Arabic doesn't meet English on the page. Anything else falls back to English.
type Words = { scanMe: string; stepInside: string; backCover: string; page: (n: number, total: number) => string };

const WORDS: Record<string, Words> = {
  en: { scanMe: "Scan me", stepInside: "Step inside", backCover: "Back cover", page: (n, total) => `Page ${n} of ${total}` },
  fr: { scanMe: "Scanne-moi", stepInside: "Entrer", backCover: "Dos du livre", page: (n, total) => `Page ${n} sur ${total}` },
  ar: { scanMe: "امسحني", stepInside: "ادخل", backCover: "الغلاف الخلفي", page: (n, total) => `صفحة ${n} من ${total}` },
  es: { scanMe: "Escanéame", stepInside: "Entrar", backCover: "Contraportada", page: (n, total) => `Página ${n} de ${total}` },
  de: { scanMe: "Scanne mich", stepInside: "Hineingehen", backCover: "Rückseite", page: (n, total) => `Seite ${n} von ${total}` },
};

export function readerWords(lang: string): Words {
  return WORDS[lang.split("-")[0]!.toLowerCase()] ?? WORDS.en!;
}

/** A language in its own words, capitalised like a menu item ("Français", "العربية"). */
export function nativeLanguageName(lang: string): string {
  const name = new Intl.DisplayNames([lang], { type: "language" }).of(lang) ?? lang;
  return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
}
