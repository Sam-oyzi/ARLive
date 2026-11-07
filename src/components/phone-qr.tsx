"use client";

import { QRCodeSVG } from "qrcode.react";
import { ShieldAlert, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { createPhoneHandoff } from "@/server/actions/handoff";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const REFRESH_MS = 4 * 60 * 1000; // tokens live 5 minutes

/**
 * "Continue on your phone": a QR code that opens `path` on a phone, already signed in.
 * On a laptop running the dev server on localhost it points at the laptop's Wi-Fi address instead.
 */
export function PhoneQRDisclosure({ path, size, className }: { path: string; size?: number; className?: string }) {
  // The QR code holds a sign-in token, so only ask for one when somebody opens this.
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <details className={className} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer rounded-sm font-semibold text-ink-700">{t.scan.continueOnPhone}</summary>
      {open && (
        <div className="mt-2">
          <PhoneQR path={path} size={size} />
        </div>
      )}
    </details>
  );
}

export function PhoneQR({ path, size = 96, dark, className }: { path: string; size?: number; dark?: boolean; className?: string }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  // Only a signed-in visitor's code carries a sign-in.
  const [signedIn, setSignedIn] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      const { token, phoneOrigin, lanHost } = await createPhoneHandoff(path).catch(() => ({
        token: null,
        phoneOrigin: null,
        lanHost: null,
      }));
      if (!alive) return;
      const { protocol, hostname, port, origin } = window.location;
      const local = LOCAL_HOSTS.has(hostname);
      // `npm run dev:phone` serves phones over HTTPS on its own port; otherwise reuse this page's address.
      const base = phoneOrigin ?? (local && lanHost ? `${protocol}//${lanHost}${port ? `:${port}` : ""}` : origin);
      setUrl(token ? `${base}/handoff?t=${encodeURIComponent(token)}` : `${base}${path}`);
      setSignedIn(!!token);
      if (!phoneOrigin && local && !lanHost) setWarning("Connect this computer to Wi-Fi so your phone can reach it.");
      else if (!base.startsWith("https:")) setWarning("Phone cameras only work over HTTPS. Restart the server with: npm run dev:phone");
      else setWarning(null);
    }
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path]);

  return (
    <div className={cn("rounded-2xl border p-3", dark ? "border-white/10 bg-white/5 text-white" : "border-ink-200/70 bg-ink-50/70", className)}>
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-soft">
          {url ? <QRCodeSVG value={url} size={size} marginSize={0} /> : <div style={{ width: size, height: size }} />}
        </div>
        <div className="min-w-0 text-sm">
          <div className={cn("flex items-center gap-1.5 font-semibold", dark ? "text-white" : "text-ink-900")}>
            <Smartphone className="size-4 text-brand-400" /> {t.scan.continueOnPhone}
          </div>
          <p className={cn("mt-1 text-xs leading-relaxed", dark ? "text-white/60" : "text-ink-500")}>
            {t.scan.qrHelp(signedIn)}
          </p>
        </div>
      </div>
      {warning && (
        <div className={cn("mt-3 flex gap-2 rounded-xl px-3 py-2 text-xs font-medium", dark ? "bg-amber-400/15 text-amber-100" : "bg-amber-50 text-amber-800")}>
          <ShieldAlert className="mt-px size-3.5 shrink-0" />
          {warning}
        </div>
      )}
    </div>
  );
}
