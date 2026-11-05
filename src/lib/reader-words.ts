// The few words the reader itself puts on a page, in the book's languages, so a child reading in
// French or Arabic doesn't meet English on the page. Anything else falls back to English.
type Words = { scanPrintedBook: string; stepInside: string; placeModel: string; lookAround: string; backCover: string; page: (n: number, total: number) => string };

const WORDS: Record<string, Words> = {
  en: { scanPrintedBook: "Scan printed book", stepInside: "Step inside", placeModel: "Place model", lookAround: "Look around 360°", backCover: "Back cover", page: (n, total) => `Page ${n} of ${total}` },
  fr: { scanPrintedBook: "Scanner le livre imprimé", stepInside: "Entrer", placeModel: "Placer le modèle", lookAround: "Vue à 360°", backCover: "Dos du livre", page: (n, total) => `Page ${n} sur ${total}` },
  ar: { scanPrintedBook: "امسح الكتاب المطبوع", stepInside: "ادخل", placeModel: "ضع المجسّم", lookAround: "عرض ٣٦٠°", backCover: "الغلاف الخلفي", page: (n, total) => `صفحة ${n} من ${total}` },
  es: { scanPrintedBook: "Escanear libro impreso", stepInside: "Entrar", placeModel: "Colocar modelo", lookAround: "Vista de 360°", backCover: "Contraportada", page: (n, total) => `Página ${n} de ${total}` },
  de: { scanPrintedBook: "Gedrucktes Buch scannen", stepInside: "Hineingehen", placeModel: "Modell platzieren", lookAround: "360°-Ansicht", backCover: "Rückseite", page: (n, total) => `Seite ${n} von ${total}` },
};

export function readerWords(lang: string): Words {
  return WORDS[lang.split("-")[0]!.toLowerCase()] ?? WORDS.en!;
}

/** A language in its own words, capitalised like a menu item ("Français", "العربية"). */
export function nativeLanguageName(lang: string): string {
  const name = new Intl.DisplayNames([lang], { type: "language" }).of(lang) ?? lang;
  return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
}
