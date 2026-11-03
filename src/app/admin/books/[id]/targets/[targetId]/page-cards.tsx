"use client";

import { Image as ImageIcon, LoaderCircle } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client-bits";
import { Field, Input, Textarea } from "@/components/ui/form";
import { updateTarget } from "@/server/actions/books";

export type EditorTarget = { id: string; name: string; description: string | null; imageUrl: string; width: number; height: number };

export function TargetImageCard({
  target,
  progress,
  onReplace,
}: {
  target: EditorTarget;
  /** Upload progress while replacing, else null */
  progress: number | null;
  onReplace: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Target image</div>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={target.imageUrl} alt="" className="h-24 w-[72px] shrink-0 rounded-xl object-cover ring-1 ring-ink-200" />
        <div className="flex min-w-0 flex-col justify-between gap-2">
          <p className="text-xs leading-relaxed text-ink-500">
            The picture students point their camera at. Replacing it keeps everything placed on this page; recompile the book afterwards.
          </p>
          <Button variant="outline" size="sm" disabled={progress !== null} onClick={onReplace}>
            {progress !== null ? <LoaderCircle className="animate-spin" /> : <ImageIcon />}
            {progress !== null ? `Uploading ${Math.round(progress)}%` : "Replace image"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function PageDetails({ target }: { target: EditorTarget }) {
  const [state, action] = useActionState(updateTarget, undefined);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);
  return (
    <Card className="p-5">
      <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Page info shown to students</div>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={target.id} />
        <Field label="Title">
          <Input name="name" defaultValue={target.name} required />
        </Field>
        <Field label="Explanation" hint="Appears in the info card when a student scans this page.">
          <Textarea name="description" defaultValue={target.description ?? ""} placeholder="The heart pumps blood through…" />
        </Field>
        <SubmitButton variant="outline" size="sm" pendingText="Saving…">
          Save page info
        </SubmitButton>
      </form>
    </Card>
  );
}
