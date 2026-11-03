"use client";

import { BookPlus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { SubmitButton, Spinner } from "@/components/ui/client-bits";
import { Field, FormError, Select, Textarea } from "@/components/ui/form";
import { runAction } from "@/lib/action-client";
import { STORY_STATUS } from "@/lib/stories";
import { deliverStory, startStoryBook, updateStoryRequest } from "@/server/actions/stories";

export function StartBookButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await runAction(startStoryBook(requestId));
          if (result?.data) router.push(`/admin/books/${result.data.bookId}`);
        })
      }
    >
      {pending ? <Spinner /> : <BookPlus />} Start the book
    </Button>
  );
}

export function DeliverButton({ requestId, childName }: { requestId: string; childName: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button onClick={() => setConfirming(true)}>
        <Send /> Deliver to the family
      </Button>
      <Confirm
        open={confirming}
        onOpenChange={setConfirming}
        title={`Deliver ${childName}'s story?`}
        description="The book is published privately for this family and appears in their account, ready to read."
        confirmLabel="Deliver"
        onConfirm={() => runAction(deliverStory(requestId))}
      />
    </>
  );
}

export function RequestStatusForm({ id, status, adminNote }: { id: string; status: string; adminNote: string | null }) {
  const [state, action] = useActionState(updateStoryRequest, undefined);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);
  const delivered = status === "DELIVERED";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <FormError message={state?.error} />
      {delivered ? (
        <input type="hidden" name="status" value="IN_PROGRESS" />
      ) : (
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status}>
            {(["NEW", "IN_PROGRESS", "DECLINED"] as const).map((s) => (
              <option key={s} value={s}>
                {STORY_STATUS[s].label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Note to the family" htmlFor="adminNote" hint="Shown in their account, e.g. when to expect the story or why it can't be made.">
        <Textarea id="adminNote" name="adminNote" maxLength={1000} defaultValue={adminNote ?? ""} className="min-h-24" />
      </Field>
      <SubmitButton variant="outline" pendingText="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
