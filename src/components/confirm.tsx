"use client";

import { AlertDialog } from "radix-ui";
import { useState, useTransition, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/client-bits";

/** Wrap a trigger; asks before running a destructive action. */
export function Confirm({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | void;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [pending, start] = useTransition();

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      {children && <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed inset-x-3 bottom-3 z-50 rounded-3xl bg-white p-6 shadow-lift data-[state=open]:animate-fade-up sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2">
          <AlertDialog.Title className="font-display text-lg font-semibold text-ink-900">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-ink-500">
            {description ?? "This can't be undone."}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className={buttonClasses("ghost")}>Cancel</AlertDialog.Cancel>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {pending && <Spinner />}
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
