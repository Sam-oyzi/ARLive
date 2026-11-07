"use client";

import { LOCALE_COOKIE, localeDir, localeFrom } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";

// Replaces the root layout when that layout itself fails, so it can't rely on global styles, fonts or
// the language provider: it reads the visitor's language straight from its cookie.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const locale = localeFrom(typeof document === "undefined" ? undefined : document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`))?.[1]);
  const t = messages[locale];
  return (
    <html lang={locale} dir={localeDir(locale)}>
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif", color: "#1e1a16" }}>
        <title>{`${t.errors.title} · PageWakes`}</title>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{t.errors.title}</h1>
          <p style={{ color: "#6a6a86", margin: "8px 0 24px" }}>{t.errors.text}</p>
          <button
            onClick={() => retry()}
            style={{ height: 44, padding: "0 20px", border: 0, borderRadius: 12, background: "#176052", color: "#fff", font: "inherit", fontWeight: 600, cursor: "pointer" }}
          >
            {t.common.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
