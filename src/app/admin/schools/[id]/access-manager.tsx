"use client";

import { useOptimistic, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { runAction } from "@/lib/action-client";
import { SubjectIcon } from "@/lib/subject-icons";
import { setSchoolAccess } from "@/server/actions/schools";

type Subject = {
  id: string;
  name: string;
  icon: string;
  color: string;
  books: { id: string; title: string; gradeLevel: string | null; published: boolean; targets: number }[];
};

/** Toggle which books (or whole subjects) a school's students can open. */
export function AccessManager({ schoolId, subjects, granted }: { schoolId: string; subjects: Subject[]; granted: string[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(new Set(granted), (current, change: { ids: string[]; on: boolean }) => {
    const next = new Set(current);
    for (const id of change.ids) {
      if (change.on) next.add(id);
      else next.delete(id);
    }
    return next;
  });

  const toggle = (ids: string[], on: boolean) =>
    startTransition(async () => {
      apply({ ids, on });
      await runAction(setSchoolAccess(schoolId, ids, on));
    });

  if (subjects.every((s) => s.books.length === 0)) {
    return <p className="py-6 text-center text-sm text-ink-500">No books exist yet. Create books first, then grant them here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {subjects
        .filter((s) => s.books.length > 0)
        .map((subject) => {
          const ids = subject.books.map((b) => b.id);
          const count = ids.filter((id) => optimistic.has(id)).length;
          const all = count === ids.length;
          return (
            <div key={subject.id} className="overflow-hidden rounded-2xl border border-ink-200/70">
              <div className="flex items-center gap-3 bg-ink-50/80 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: subject.color }}>
                  <SubjectIcon icon={subject.icon} className="size-[18px]" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-900">{subject.name}</div>
                  <div className="text-xs text-ink-500">
                    {count} of {ids.length} books granted
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-600">
                  Whole subject
                  <Switch checked={all} onCheckedChange={(on) => toggle(ids, on)} aria-label={`Grant all of ${subject.name}`} />
                </label>
              </div>
              <ul className="divide-y divide-ink-100">
                {subject.books.map((book) => (
                  <li key={book.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink-800">{book.title}</span>
                        {!book.published && <Badge tone="amber">Draft</Badge>}
                      </div>
                      <div className="text-xs text-ink-500">
                        {[book.gradeLevel, `${book.targets} AR pages`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Switch
                      checked={optimistic.has(book.id)}
                      onCheckedChange={(on) => toggle([book.id], on)}
                      aria-label={`Grant ${book.title}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
    </div>
  );
}
