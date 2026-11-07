import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "./join-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.join };
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const { t } = await getI18n();
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">{t.auth.join.title}</h1>
      <p className="mt-2 text-[15px] text-ink-500">{t.auth.join.text}</p>
      <JoinForm code={code} />
      <p className="mt-6 text-center text-sm text-ink-500">
        {t.auth.signup.already}{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          {t.auth.signup.signIn}
        </Link>
      </p>
    </>
  );
}
