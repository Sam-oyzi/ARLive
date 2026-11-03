"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Logo } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="grid size-16 place-items-center rounded-2xl bg-rose-50 text-rose-500">
        <TriangleAlert className="size-7" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-ink-500">It&apos;s not your fault. Please try again in a moment.</p>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
