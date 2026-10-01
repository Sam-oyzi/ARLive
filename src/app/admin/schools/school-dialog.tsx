"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/image-upload-field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client-bits";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/form";
import { SUBJECT_COLORS } from "@/lib/subject-icons";
import { saveSchool } from "@/server/actions/schools";

type School = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  contactEmail: string | null;
  color: string;
  maxStudents: number | null;
  logoUrl: string | null;
};

export function SchoolDialog({ school, children }: { school?: School; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveSchool, undefined);
  const [color, setColor] = useState(school?.color ?? SUBJECT_COLORS[0]!);
  const router = useRouter();

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message);
    setOpen(false);
    if (!school && state.data) router.push(`/admin/schools/${state.data.id}`);
  }, [state, school, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={school ? "Edit school" : "New school"} description="Schools get a join code their students use to sign up." wide>
        <form action={action} className="flex flex-col gap-5">
          {school && <input type="hidden" name="id" value={school.id} />}
          <input type="hidden" name="color" value={color} />
          <FormError message={state?.error} />
          <div className="grid gap-5 sm:grid-cols-[112px_1fr]">
            <ImageUploadField name="logoUrl" kind="logos" defaultValue={school?.logoUrl} label="Logo" />
            <div className="flex flex-col gap-4">
              <Field label="School name" htmlFor="name">
                <Input id="name" name="name" defaultValue={school?.name} required placeholder="Lycée Ibn Sina" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" htmlFor="city">
                  <Input id="city" name="city" defaultValue={school?.city ?? ""} />
                </Field>
                <Field label="Country" htmlFor="country">
                  <Input id="country" name="country" defaultValue={school?.country ?? ""} />
                </Field>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact email" htmlFor="contactEmail">
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={school?.contactEmail ?? ""} />
            </Field>
            <Field label="Student seats" htmlFor="maxStudents" hint="Leave empty for unlimited">
              <Input id="maxStudents" name="maxStudents" type="number" min={1} defaultValue={school?.maxStudents ?? ""} />
            </Field>
          </div>
          <Field label="Brand colour">
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className="grid size-8 place-items-center rounded-full transition hover:scale-110"
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
            <SubmitButton pendingText="Saving…">{school ? "Save changes" : "Create school"}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
