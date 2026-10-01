"use client";

import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

/** Desktop helper: scan this with a phone to open the same AR page there. */
export function PhoneQR({ path, size = 96 }: { path: string; size?: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(new URL(path, window.location.origin).toString()), [path]);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-ink-200/70 bg-ink-50/70 p-3">
      <div className="rounded-xl bg-white p-1.5 shadow-soft">
        {url ? <QRCodeSVG value={url} size={size} /> : <div style={{ width: size, height: size }} />}
      </div>
      <div className="text-sm">
        <div className="flex items-center gap-1.5 font-semibold text-ink-900">
          <Smartphone className="size-4 text-brand-500" /> On a computer?
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">Scan this code with your phone&apos;s camera to open AR there.</p>
      </div>
    </div>
  );
}
