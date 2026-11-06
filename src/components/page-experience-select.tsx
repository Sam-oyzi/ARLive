"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { runAction } from "@/lib/action-client";
import { SCAN_ACTIONS, SCAN_ACTION_LABEL, scanActionOf, type ScanAction } from "@/lib/scan-actions";
import { cn } from "@/lib/utils";
import { savePageScanAction } from "@/server/actions/books";
import { requestStoryMotion } from "@/lib/story-motion";

export function ExperiencePreviewLink({ href, withMotion = false }: { href: string; withMotion?: boolean }) {
  return <Link href={href} onClick={() => { if (withMotion) void requestStoryMotion(); }} className={buttonClasses("outline", "sm")}><Eye /> Preview experience</Link>;
}

/** The same saved choice in the book's page grid and the individual page editor. */
export function PageExperienceSelect({ targetId, action, hasWorld, hasModel = false, compact, label = "Page experience" }: {
  targetId: string;
  action: ScanAction;
  hasWorld: boolean;
  hasModel?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(action);
  return (
    <Select
      aria-label={label}
      aria-busy={pending}
      value={value}
      disabled={pending}
      title="Scanning automatically opens the selected experience. Quick Look and 8th Wall use the first 3D item in Layers. Add a 3D model to enable them, or story artwork to enable Step Inside and 360°."
      className={cn(compact && "h-10 px-2.5 pr-8 text-xs font-semibold")}
      onChange={(event) => {
        const next = scanActionOf(event.target.value);
        start(async () => {
          setValue(next);
          await runAction(savePageScanAction(targetId, next));
        });
      }}
    >
      {SCAN_ACTIONS.map((option) => (
        <option key={option} value={option} disabled={(["world", "panorama"].includes(option) && !hasWorld) || (["quicklook", "eighthwall"].includes(option) && !hasModel)}>
          {SCAN_ACTION_LABEL[option]}
        </option>
      ))}
    </Select>
  );
}
