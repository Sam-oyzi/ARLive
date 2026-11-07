import { LoaderCircle } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";

/** Shown inside a layout while the next page loads, so taps always get feedback on slow networks. */
export async function PageLoading() {
  const { t } = await getI18n();
  return (
    <div role="status" aria-label={t.common.loading} className="grid min-h-64 place-items-center text-brand-500">
      <LoaderCircle className="size-7 animate-spin" />
    </div>
  );
}
