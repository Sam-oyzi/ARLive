import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ARLive — Augmented reality for every classroom", template: "%s · ARLive" },
  description:
    "Scan a textbook page and watch molecules, organs and planets come alive in 3D. ARLive lets schools bring augmented reality to every subject.",
  applicationName: "ARLive",
  appleWebApp: { capable: true, title: "ARLive", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#5b5bf6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh">
        {children}
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
