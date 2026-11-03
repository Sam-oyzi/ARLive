"use client";

// Replaces the root layout when that layout itself fails, so it can't rely on global styles or fonts.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif", color: "#1e1a16" }}>
        <title>Something went wrong · Sketchling</title>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#6a6a86", margin: "8px 0 24px" }}>It&apos;s not your fault. Please try again in a moment.</p>
          <button
            onClick={() => retry()}
            style={{ height: 44, padding: "0 20px", border: 0, borderRadius: 12, background: "#c4460b", color: "#fff", font: "inherit", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
