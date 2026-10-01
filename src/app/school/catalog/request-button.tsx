"use client";

import { Clock, Send } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/action-client";
import { cancelRequest, requestAccess } from "@/server/actions/requests";

export function RequestButton({ bookId, pendingRequestId }: { bookId: string; pendingRequestId?: string }) {
  const [pending, start] = useTransition();
  if (pendingRequestId) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(() => runAction(cancelRequest(pendingRequestId)).then(() => {}))}
        title="Cancel request"
        className="group"
      >
        <Clock className="text-amber-500" />
        <span className="group-hover:hidden">Requested</span>
        <span className="hidden group-hover:inline">Cancel</span>
      </Button>
    );
  }
  return (
    <Button size="sm" variant="soft" disabled={pending} onClick={() => start(() => runAction(requestAccess(bookId)).then(() => {}))}>
      <Send /> Request
    </Button>
  );
}
