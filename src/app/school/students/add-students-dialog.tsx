"use client";

import { Printer, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton, SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { createStudents } from "@/server/actions/users";

/** Paste a class list; get printable username/password slips back. */
export function AddStudentsDialog({ schoolName }: { schoolName: string }) {
  const [open, setOpen] = useState(false);
  // Remount the body each time the dialog opens so the previous results are cleared.
  const [session, setSession] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSession((s) => s + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Add students
        </Button>
      </DialogTrigger>
      <AddStudentsBody key={session} schoolName={schoolName} close={() => setOpen(false)} />
    </Dialog>
  );
}

function AddStudentsBody({ schoolName, close }: { schoolName: string; close: () => void }) {
  const [state, action] = useActionState(createStudents, undefined);
  const created = state?.ok ? state.data : undefined;

  function print() {
    if (!created) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const slips = created
      .map(
        (s) => `<div class="slip"><b>${escapeHtml(s.name)}</b><div>${escapeHtml(schoolName)} · ARLive</div>
        <div>Username: <code>${escapeHtml(s.username)}</code></div><div>Password: <code>${escapeHtml(s.password)}</code></div>
        <div class="url">${window.location.origin}/login</div></div>`,
      )
      .join("");
    win.document.write(`<!doctype html><title>Student accounts</title><style>
      body{font-family:system-ui,sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px}
      .slip{border:1.5px dashed #999;border-radius:12px;padding:14px;font-size:14px;line-height:1.7;break-inside:avoid}
      code{font-size:15px;font-weight:700;letter-spacing:.05em}.url{color:#666;font-size:12px}</style>${slips}`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
      <DialogContent
        title={created ? `${created.length} account${created.length === 1 ? "" : "s"} created` : "Add students"}
        description={
          created
            ? "Hand these out now — passwords can't be shown again (you can reset them later)."
            : "Paste one full name per line. We'll create usernames and passwords for you."
        }
        wide
      >
        {created ? (
          <div className="flex flex-col gap-4">
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-ink-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-50 text-left text-xs text-ink-500 uppercase">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Username</th>
                    <th className="px-4 py-2">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {created.map((s) => (
                    <tr key={s.username} className="border-t border-ink-100">
                      <td className="px-4 py-2 font-medium text-ink-900">{s.name}</td>
                      <td className="px-4 py-2 font-mono text-ink-700">{s.username}</td>
                      <td className="px-4 py-2 font-mono font-semibold text-ink-900">{s.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <CopyButton value={created.map((s) => `${s.name}\t${s.username}\t${s.password}`).join("\n")} label="Copy as table" />
              <Button variant="outline" size="sm" onClick={print}>
                <Printer /> Print slips
              </Button>
              <Button size="sm" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <FormError message={state?.error} />
            <Field label="Students" htmlFor="names" hint="One full name per line — up to 300 at once.">
              <Textarea id="names" name="names" required className="min-h-48 font-mono text-[13px]" placeholder={"Amina El Idrissi\nYoussef Benali\nSara Haddad"} />
            </Field>
            <Field label="Class / grade" htmlFor="grade">
              <Input id="grade" name="grade" placeholder="e.g. 2nd year — Class B" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <SubmitButton pendingText="Creating accounts…">Create accounts</SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
