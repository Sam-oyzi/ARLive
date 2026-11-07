"use client";

import { QRCodeSVG } from "qrcode.react";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/client-bits";
import { runAction } from "@/lib/action-client";
import { regenerateJoinCode } from "@/server/actions/schools";
import { useI18n } from "@/lib/i18n/client";

/** The code (and QR) students use to create their account in this school. */
export function JoinCodeCard({ schoolId, joinCode }: { schoolId: string; joinCode: string }) {
  const [origin, setOrigin] = useState("");
  const { t } = useI18n();
  const d = t.dashboard;
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/join?code=${joinCode}`;

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-5 bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white/80">{d.joinCode}</div>
          <div dir="ltr" className="mt-2 text-start font-mono text-[28px] leading-none font-bold tracking-[0.18em]">{joinCode}</div>
          <p className="mt-3 text-xs leading-relaxed text-white/75">
            {d.joinHelpA} <span dir="ltr" className="font-semibold text-white">/join</span> {d.joinHelpB}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-white p-2">{origin && <QRCodeSVG value={link} size={88} />}</div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex gap-2">
          <CopyButton value={joinCode} label={d.copyCode} />
          {origin && <CopyButton value={link} label={d.copyLink} />}
        </div>
        <Confirm
          title={d.newCodeTitle}
          description={d.newCodeText}
          confirmLabel={d.generate}
          onConfirm={() => runAction(regenerateJoinCode(schoolId))}
        >
          <Button variant="ghost" size="sm">
            <RefreshCw /> {d.newCode}
          </Button>
        </Confirm>
      </div>
    </Card>
  );
}
