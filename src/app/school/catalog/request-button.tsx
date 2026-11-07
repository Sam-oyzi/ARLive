"use client";

import { Clock, Send } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/action-client";
import { cancelRequest, requestAccess } from "@/server/actions/requests";
import { useI18n } from "@/lib/i18n/client";

export function RequestButton({ bookId, pendingRequestId }: { bookId: string; pendingRequestId?: string }) {
  const [pending, start] = useTransition();
  const { t } = useI18n();
  const d = t.dashboard;
  if (pendingRequestId) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(() => runAction(cancelRequest(pendingRequestId)).then(() => {}))}
        title={d.cancelRequest}
        className="group"
      >
        <Clock className="text-amber-500" />
        <span className="group-hover:hidden">{d.requested}</span>
        <span className="hidden group-hover:inline">{d.cancel}</span>
      </Button>
    );
  }
  return (
    <Button size="sm" variant="soft" disabled={pending} onClick={() => start(() => runAction(requestAccess(bookId)).then(() => {}))}>
      <Send className="rtl:-scale-x-100" /> {d.request}
    </Button>
  );
}
