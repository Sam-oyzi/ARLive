import { Compass } from "lucide-react";
import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <Compass className="size-7" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-ink-500">Or you don&apos;t have access to it. Check with your school if you think you should.</p>
      </div>
      <ButtonLink href="/">Back home</ButtonLink>
    </div>
  );
}
