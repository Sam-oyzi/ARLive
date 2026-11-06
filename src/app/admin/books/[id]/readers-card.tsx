"use client";

import { Check, Lock, Mail, X } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { runAction } from "@/lib/action-client";
import { VISIBILITIES, type Visibility } from "@/lib/visibility";
import { cn } from "@/lib/utils";
import { addBookReaders, decideBookReader, removeBookReader, setBookVisibility } from "@/server/actions/readers";

export type ReaderRow = { id: string; email: string; status: string; message: string | null };

/** Approve or decline one waiting request. */
export function ReaderDecision({ readerId }: { readerId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 gap-1.5">
      <Button size="xs" variant="ghost" disabled={pending} onClick={() => start(async () => void (await runAction(decideBookReader(readerId, false))))}>
        <X /> Decline
      </Button>
      <Button size="xs" disabled={pending} onClick={() => start(async () => void (await runAction(decideBookReader(readerId, true))))}>
        <Check /> Approve
      </Button>
    </div>
  );
}

/** Who may open a book: everyone, any account, or only approved emails (always, for a custom story). */
export function ReadersCard({ bookId, visibility, custom, readers }: { bookId: string; visibility: Visibility; custom: boolean; readers: ReaderRow[] }) {
  const [current, setCurrent] = useOptimistic(visibility);
  const [emails, setEmails] = useState("");
  const [pending, start] = useTransition();
  const waiting = readers.filter((r) => r.status === "PENDING");
  const approved = readers.filter((r) => r.status === "APPROVED");
  const listed = custom || current === "APPROVED";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Who can read it</CardTitle>
          <CardDescription>
            {custom ? "A custom story opens only for the emails approved here. Delivering it approves the family." : VISIBILITIES[current].hint}
          </CardDescription>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        {!custom && (
          <div role="radiogroup" aria-label="Who can read it" className="grid gap-1.5">
            {(Object.keys(VISIBILITIES) as Visibility[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={current === key}
                onClick={() =>
                  start(async () => {
                    setCurrent(key);
                    await runAction(setBookVisibility(bookId, key));
                  })
                }
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                  current === key ? "border-brand-300 bg-brand-50 text-brand-800" : "border-ink-200 text-ink-700 hover:border-ink-300",
                )}
              >
                <span>
                  <span className="block font-semibold">{VISIBILITIES[key].label}</span>
                  <span className="block text-xs text-ink-500">{VISIBILITIES[key].hint}</span>
                </span>
                <span className={cn("size-4 shrink-0 rounded-full border-2", current === key ? "border-brand-600 bg-brand-600 shadow-[inset_0_0_0_2px_white]" : "border-ink-300")} />
              </button>
            ))}
          </div>
        )}

        {waiting.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Asking for access <Badge tone="amber">{waiting.length}</Badge>
            </p>
            <ul className="flex flex-col gap-2">
              {waiting.map((r) => (
                <li key={r.id} className="rounded-xl bg-amber-50/70 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-ink-900">{r.email}</span>
                    <ReaderDecision readerId={r.id} />
                  </div>
                  {r.message && <p className="mt-1 text-xs text-ink-600">“{r.message}”</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {listed && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              <Lock className="size-3.5" /> Approved emails
            </p>
            {approved.length === 0 ? (
              <p className="text-sm text-ink-500">Nobody yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ink-100">
                {approved.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink-800">
                      <Mail className="size-3.5 shrink-0 text-ink-400" /> <span className="truncate">{r.email}</span>
                    </span>
                    <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove ${r.email}`} onClick={() => runAction(removeBookReader(r.id))}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                start(async () => {
                  const result = await runAction(addBookReaders(bookId, emails));
                  if (result?.ok) setEmails("");
                });
              }}
            >
              <Textarea
                value={emails}
                onChange={(event) => setEmails(event.target.value)}
                aria-label="Emails to approve"
                placeholder="parent@example.com, grandma@example.com"
                className="min-h-16 text-sm"
              />
              <Button type="submit" size="sm" variant="outline" disabled={pending || !emails.trim()} className="self-start">
                <Check /> Approve emails
              </Button>
              <p className="text-xs text-ink-500">They can read it as soon as they sign in with that email, even if they sign up later.</p>
            </form>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
