import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = { sm: "size-3.5", md: "size-4", lg: "size-5" };

/** Five stars filled to `value` (0–5), halves included. */
export function Stars({ value, size = "sm", className }: { value: number; size?: keyof typeof SIZES; className?: string }) {
  const filled = (Math.max(0, Math.min(5, value)) / 5) * 100;
  const row = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} aria-hidden="true" className={cn(SIZES[size], "shrink-0")} fill="currentColor" strokeWidth={0} />
      ))}
    </>
  );
  return (
    <span role="img" aria-label={`${value.toFixed(1)} out of 5 stars`} className={cn("relative inline-flex", className)}>
      <span className="flex text-ink-200">{row}</span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden text-amber-400" style={{ width: `${filled}%` }}>
        {row}
      </span>
    </span>
  );
}

/** "★★★★☆ 4.3 (12)", or a quiet "Not rated yet". */
export function RatingSummary({ average, count, size, className }: { average: number; count: number; size?: keyof typeof SIZES; className?: string }) {
  if (count === 0) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-400", className)}>
        <Stars value={0} size={size} /> Not rated yet
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-500", className)}>
      <Stars value={average} size={size} />
      <span className="font-semibold text-ink-800 tabular-nums">{average.toFixed(1)}</span>
      <span className="tabular-nums">({count})</span>
    </span>
  );
}
