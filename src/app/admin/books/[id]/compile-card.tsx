"use client";

import { Cpu, RefreshCw, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CompileBadge } from "@/components/compile-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { compileTargets } from "@/ar/compile";
import type { CompileState } from "@/lib/books";
import { plural } from "@/lib/utils";

/** Runs MindAR's target compiler in this browser tab, then uploads the .mind file. */
export function CompileCard({
  bookId,
  targets,
  state,
  compiledLabel,
}: {
  bookId: string;
  targets: { id: string; imageUrl: string }[];
  state: CompileState;
  /** e.g. "Last compiled 3 minutes ago", computed on the server so it can't mismatch on hydration */
  compiledLabel: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const router = useRouter();

  async function compile() {
    setProgress(0);
    setStage("Loading the AR compiler…");
    try {
      const data = await compileTargets(
        targets.map((t) => t.imageUrl),
        (p) => {
          setProgress(p);
          setStage(p < 50 ? "Finding feature points…" : "Building tracking data…");
        },
      );
      setStage("Uploading…");
      const res = await fetch(`/api/books/${bookId}/mind?targets=${targets.map((t) => t.id).join(",")}`, {
        method: "PUT",
        body: data as BlobPart,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      toast.success(`Compiled ${plural(targets.length, "page")} — AR is ready`);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message || "Compilation failed");
    } finally {
      setProgress(null);
    }
  }

  const running = progress !== null;
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-ink-950 px-6 py-5 text-white">
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10">
              <Cpu className="size-5" />
            </span>
            <div>
              <div className="font-display font-semibold">AR compiler</div>
              <div className="text-xs text-white/60">
                {compiledLabel}
              </div>
            </div>
          </div>
          <CompileBadge state={state} />
        </div>
      </div>
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm text-ink-600">
          {state === "ready" && "Every page is compiled. Students can scan this book."}
          {state === "stale" && "Pages were added, removed or replaced since the last compile. Recompile so students get the changes."}
          {state === "missing" && "Compile the pages into tracking data. It runs here in your browser and takes a few seconds per page."}
          {state === "empty" && "Upload at least one page to compile."}
        </p>
        {running && (
          <div>
            <div className="mb-2 flex justify-between text-xs font-medium text-ink-600">
              <span>{stage}</span>
              <span className="tabular-nums">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
            <p className="mt-2 text-xs text-ink-400">Keep this tab open until it finishes.</p>
          </div>
        )}
        <Button onClick={compile} disabled={running || targets.length === 0} variant={state === "ready" ? "outline" : "primary"}>
          {state === "ready" ? <RefreshCw /> : <Wand2 />}
          {running ? "Compiling…" : state === "ready" ? "Recompile" : `Compile ${plural(targets.length, "page")}`}
        </Button>
      </CardBody>
    </Card>
  );
}
