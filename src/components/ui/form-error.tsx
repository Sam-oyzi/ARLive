"use client";

import { useI18n } from "@/lib/i18n/client";
import { localizeMessage } from "@/lib/i18n/messages";

export function FormError({ message }: { message?: string | null }) {
  const { t } = useI18n();
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
      {localizeMessage(message, t)}
    </div>
  );
}
