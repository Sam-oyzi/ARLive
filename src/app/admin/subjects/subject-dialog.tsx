"use client";

import { Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { runAction } from "@/lib/action-client";
import { SUBJECT_COLORS, SUBJECT_ICONS } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import { deleteSubject, saveSubject } from "@/server/actions/subjects";

type Subject = { id: string; name: string; description: string | null; icon: string; color: string; order: number };

export function SubjectDialog({
  subject,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  subject?: Subject;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [state, action] = useActionState(saveSubject, undefined);
  const [icon, setIcon] = useState(subject?.icon ?? "atom");
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[0]!);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state, setOpen]);

  const Preview = SUBJECT_ICONS[icon]!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent title={subject ? "Edit subject" : "New subject"} description="Students pick a subject first, then scan its books." wide>
        <form action={action} className="flex flex-col gap-5">
          {subject && <input type="hidden" name="id" value={subject.id} />}
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />
          <FormError message={state?.error} />

          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl text-white transition" style={{ background: color }}>
              <Preview className="size-8" />
            </span>
            <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_96px]">
              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" defaultValue={subject?.name} placeholder="Chemistry" required />
              </Field>
              <Field label="Order" htmlFor="order">
                <Input id="order" name="order" type="number" min={0} defaultValue={subject?.order} />
              </Field>
            </div>
          </div>

          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={subject?.description ?? ""} placeholder="Atoms, molecules and reactions in 3D." className="min-h-20" />
          </Field>

          <Field label="Icon">
            <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-12">
              {Object.entries(SUBJECT_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={key}
                  aria-pressed={icon === key}
                  className={cn(
                    "grid aspect-square place-items-center rounded-xl border transition",
                    icon === key ? "border-transparent text-white" : "border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-800",
                  )}
                  style={icon === key ? { background: color } : undefined}
                >
                  <Icon className="size-[18px]" />
                </button>
              ))}
            </div>
          </Field>

          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className="grid size-8 place-items-center rounded-full ring-offset-2 transition hover:scale-110"
                  style={{ background: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
                >
                  {color === c && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{subject ? "Save changes" : "Create subject"}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubjectActions({ subject }: { subject: Subject }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Subject actions">
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit
          </DropdownItem>
          <DropdownItem danger onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <SubjectDialog subject={subject} open={editing} onOpenChange={setEditing} />
      <Confirm
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${subject.name}?`}
        description="Only empty subjects can be deleted."
        onConfirm={() => runAction(deleteSubject(subject.id))}
      />
    </>
  );
}
