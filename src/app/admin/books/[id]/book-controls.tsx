"use client";

import { ArrowDown, ArrowUp, ImageUp, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Switch } from "@/components/ui/switch";
import { runAction } from "@/lib/action-client";
import { replaceTargetImageFromFile, TARGET_IMAGE_ACCEPT } from "@/lib/target-image-client";
import { deleteBook, deleteTarget, moveTarget, setBookPublished } from "@/server/actions/books";

export function PublishSwitch({ bookId, published, disabled }: { bookId: string; published: boolean; disabled?: boolean }) {
  const [, start] = useTransition();
  const [value, setValue] = useOptimistic(published);
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 shadow-soft">
      {value ? "Published" : "Draft"}
      <Switch
        checked={value}
        disabled={disabled && !value}
        onCheckedChange={(on) =>
          start(async () => {
            setValue(on);
            await runAction(setBookPublished(bookId, on));
          })
        }
      />
    </label>
  );
}

export function BookMenu({ bookId, title }: { bookId: string; title: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem danger onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete book
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <Confirm
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${title}”?`}
        description="Its pages, 3D content, uploaded files and scan history are deleted for every school."
        onConfirm={async () => {
          const result = await runAction(deleteBook(bookId));
          if (result?.ok) router.push("/admin/books");
        }}
      />
    </>
  );
}

export function TargetMenu({ targetId, name, first, last }: { targetId: string; name: string; first: boolean; last: boolean }) {
  const [deleting, setDeleting] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <button
            className="grid size-8 place-items-center rounded-full bg-white/90 text-ink-700 shadow backdrop-blur transition hover:bg-white"
            aria-label={`Actions for ${name}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => imageInput.current?.click()}>
            <ImageUp /> Replace image
          </DropdownItem>
          {!first && (
            <DropdownItem onSelect={() => runAction(moveTarget(targetId, -1))}>
              <ArrowUp /> Move earlier
            </DropdownItem>
          )}
          {!last && (
            <DropdownItem onSelect={() => runAction(moveTarget(targetId, 1))}>
              <ArrowDown /> Move later
            </DropdownItem>
          )}
          <DropdownSeparator />
          <DropdownItem danger onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete page
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <Confirm
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${name}”?`}
        description="The page image and everything placed on it are deleted. Recompile the book afterwards."
        onConfirm={() => runAction(deleteTarget(targetId))}
      />
      {/* Lives outside the menu: the menu unmounts when it closes, before the file picker returns. */}
      <input
        ref={imageInput}
        type="file"
        accept={TARGET_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) replaceTargetImageFromFile(targetId, file);
          e.target.value = "";
        }}
      />
    </>
  );
}
