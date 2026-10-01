import { Badge } from "@/components/ui/badge";
import type { CompileState } from "@/lib/books";

export function CompileBadge({ state }: { state: CompileState }) {
  switch (state) {
    case "ready":
      return <Badge tone="green" dot>AR ready</Badge>;
    case "stale":
      return <Badge tone="amber" dot>Needs recompile</Badge>;
    case "missing":
      return <Badge tone="amber" dot>Not compiled</Badge>;
    case "empty":
      return <Badge tone="neutral" dot>No pages</Badge>;
  }
}
