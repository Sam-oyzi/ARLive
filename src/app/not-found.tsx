import { Compass } from "lucide-react";
import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <Compass className="size-7" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">{t.errors.notFoundTitle}</h1>
        <p className="mt-2 text-ink-500">{t.errors.notFoundText}</p>
      </div>
      <ButtonLink href="/">{t.common.backHome}</ButtonLink>
    </div>
  );
}
