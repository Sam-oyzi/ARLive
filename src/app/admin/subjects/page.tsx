import { Plus, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/utils";
import { SubjectActions, SubjectDialog } from "./subject-dialog";

export const metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  await requireUser(["SUPER_ADMIN"]);
  const subjects = await db.subject.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { books: { select: { published: true, _count: { select: { targets: true } } } } },
  });

  const addButton = (
    <SubjectDialog>
      <Button>
        <Plus /> New subject
      </Button>
    </SubjectDialog>
  );

  return (
    <>
      <PageHeader
        title="Subjects"
        description="The matières students choose from. Each subject groups the AR books that belong to it."
        actions={addButton}
      />
      {subjects.length === 0 ? (
        <EmptyState icon={Shapes} title="No subjects yet" description="Create Chemistry, Biology, Physics… to organise your books." action={addButton} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const published = subject.books.filter((b) => b.published).length;
            const pages = subject.books.reduce((sum, b) => sum + b._count.targets, 0);
            return (
              <div
                key={subject.id}
                className="group relative overflow-hidden rounded-3xl border border-ink-200/70 bg-white p-5 shadow-soft transition hover:shadow-lift"
              >
                <div
                  className="absolute -top-16 -right-16 size-44 rounded-full opacity-[0.12] transition group-hover:scale-110"
                  style={{ background: subject.color }}
                />
                <div className="relative flex items-start justify-between">
                  <span
                    className="grid size-14 place-items-center rounded-2xl text-white shadow-[0_10px_24px_-10px_var(--c)]"
                    style={{ background: subject.color, ["--c" as string]: subject.color }}
                  >
                    <SubjectIcon icon={subject.icon} className="size-7" />
                  </span>
                  <SubjectActions subject={subject} />
                </div>
                <h3 className="relative mt-4 font-display text-lg font-bold text-ink-900">{subject.name}</h3>
                <p className="relative mt-1 line-clamp-2 min-h-10 text-sm text-ink-500">
                  {subject.description || "No description yet."}
                </p>
                <div className="relative mt-4 flex gap-4 text-xs font-medium text-ink-500">
                  <span>{plural(subject.books.length, "book")}</span>
                  <span>{published} published</span>
                  <span>{plural(pages, "AR page")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
