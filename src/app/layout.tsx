import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fredoka, Gelasio, Instrument_Serif, Noto_Naskh_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { SoundUnlock } from "@/components/sound-unlock";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
// Book reader captions
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
// Picture-book pages (src/lib/story-page.ts): a sturdy book serif for the text, a round bold face for sound words.
const story = Gelasio({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-story", display: "swap" });
const sound = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sound", display: "swap" });
// Arabic books: a clear book Naskh, used for Arabic letters wherever the faces above have none.
const arabic = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["500", "600", "700"], variable: "--font-arabic", display: "swap", preload: false });
// (not preloaded: browsers fetch it only when a page shows Arabic)

export const metadata: Metadata = {
  title: { default: "Sketchling — Illustrated stories for kids", template: "%s · Sketchling" },
  description:
    "Read illustrated children's stories together and use your phone to bring selected pages to life in 3D.",
  applicationName: "Sketchling",
  appleWebApp: { capable: true, title: "Sketchling", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#fbf7ef",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (ColorZilla, Grammarly, password managers) add
    // attributes to <html>/<body> before React loads. Only these two elements' own attributes are
    // exempted; mismatches anywhere inside are still reported.
    <html lang="en" className={`${jakarta.variable} ${bricolage.variable} ${serif.variable} ${story.variable} ${sound.variable} ${arabic.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh" suppressHydrationWarning>
        {children}
        <SoundUnlock />
        <Toaster
          position="top-center"
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
