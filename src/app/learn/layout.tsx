import { Logo } from "@/components/brand";
import { requireUser } from "@/lib/auth";
import { StudentMenu } from "./student-menu";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["STUDENT"]);
  return (
    <div className="min-h-dvh bg-[radial-gradient(80%_50%_at_50%_0%,rgb(91_91_246/0.10),transparent)]">
      <header className="sticky top-0 z-30 border-b border-ink-200/50 bg-ink-50/80 backdrop-blur-lg safe-top">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 pb-3 sm:pb-0">
          <Logo href="/learn" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-ink-500 sm:block">{user.school?.name}</span>
            <StudentMenu name={user.name} username={user.username} school={user.school?.name ?? ""} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 safe-bottom">{children}</main>
    </div>
  );
}
