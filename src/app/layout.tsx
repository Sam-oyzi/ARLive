import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Bricolage_Grotesque, Fredoka, Gelasio, Instrument_Serif, Noto_Naskh_Arabic, Noto_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { SoundUnlock } from "@/components/sound-unlock";
import { I18nProvider } from "@/lib/i18n/client";
import { localeDir } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
// Book reader captions
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
// Picture-book pages (src/lib/story-page.ts): a sturdy book serif for the text, a round bold face for sound words.
const story = Gelasio({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-story", display: "swap" });
const sound = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sound", display: "swap" });
// Arabic books: a clear book Naskh, used for Arabic letters wherever the faces above have none.
const arabic = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["500", "600", "700"], variable: "--font-arabic", display: "swap", preload: false });
// (not preloaded: browsers fetch it only when a page shows Arabic)
// The site in Arabic: a clear sans for the interface and a round, friendly face for headings, picked
// per letter by the font stacks in globals.css (Latin letters keep the faces above).
const arabicSans = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic-sans", display: "swap", preload: false });
const arabicDisplay = Baloo_Bhaijaan_2({ subsets: ["arabic"], weight: ["600", "700", "800"], variable: "--font-arabic-display", display: "swap", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.title, template: "%s · PageWakes" },
    description: t.meta.description,
    applicationName: "PageWakes",
    appleWebApp: { capable: true, title: "PageWakes", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf7ef",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  return (
    // suppressHydrationWarning: browser extensions (ColorZilla, Grammarly, password managers) add
    // attributes to <html>/<body> before React loads. Only these two elements' own attributes are
    // exempted; mismatches anywhere inside are still reported.
    <html lang={locale} dir={localeDir(locale)} className={`${jakarta.variable} ${bricolage.variable} ${serif.variable} ${story.variable} ${sound.variable} ${arabic.variable} ${arabicSans.variable} ${arabicDisplay.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh" suppressHydrationWarning>
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <SoundUnlock />
        <Toaster
          position="top-center"
          dir={localeDir(locale)}
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-ink-200/70 !shadow-lift !font-sans",
              title: "!font-semibold",
            },
          }}
        />
      </body>
    </html>
  );
}
