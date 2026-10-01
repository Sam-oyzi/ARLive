"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/image-upload-field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { saveBook } from "@/server/actions/books";

type Book = {
  id: string;
  title: string;
  description: string | null;
  gradeLevel: string | null;
  subjectId: string;
  coverUrl: string | null;
};

export function BookDialog({
  book,
  subjects,
  defaultSubjectId,
  children,
}: {
  book?: Book;
  subjects: { id: string; name: string }[];
  defaultSubjectId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveBook, undefined);
  const router = useRouter();

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message);
    setOpen(false);
    if (!book && state.data) router.push(`/admin/books/${state.data.id}`);
  }, [state, book, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={book ? "Edit book" : "New book"}
        description="A book groups the printed pages students will scan. All its pages compile into one AR file."
        wide
      >
        {subjects.length === 0 ? (
          <p className="text-sm text-ink-600">Create a subject first — every book belongs to one.</p>
        ) : (
          <form action={action} className="flex flex-col gap-5">
            {book && <input type="hidden" name="id" value={book.id} />}
            <FormError message={state?.error} />
            <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
              <ImageUploadField name="coverUrl" kind="covers" defaultValue={book?.coverUrl} label="Cover" aspect="aspect-[3/4]" />
              <div className="flex flex-col gap-4">
                <Field label="Title" htmlFor="title">
                  <Input id="title" name="title" defaultValue={book?.title} required placeholder="Chemistry — 1st year Baccalaureate" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Subject" htmlFor="subjectId">
                    <Select id="subjectId" name="subjectId" defaultValue={book?.subjectId ?? defaultSubjectId ?? subjects[0]?.id} required>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Grade level" htmlFor="gradeLevel">
                    <Input id="gradeLevel" name="gradeLevel" defaultValue={book?.gradeLevel ?? ""} placeholder="Grade 10" />
                  </Field>
                </div>
                <Field label="Description" htmlFor="description">
                  <Textarea id="description" name="description" defaultValue={book?.description ?? ""} className="min-h-20" />
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Saving…">{book ? "Save changes" : "Create book"}</SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
