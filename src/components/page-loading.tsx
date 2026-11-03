import { LoaderCircle } from "lucide-react";

/** Shown inside a layout while the next page loads, so taps always get feedback on slow networks. */
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-64 place-items-center text-brand-500">
      <LoaderCircle className="size-7 animate-spin" />
    </div>
  );
}
