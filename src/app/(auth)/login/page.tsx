import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.signIn };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t } = await getI18n();
  const l = t.auth.login;
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">{l.title}</h1>
      <p className="mt-2 text-[15px] text-ink-500">{l.text}</p>
      <LoginForm next={next} />
      <div className="mt-8 flex flex-col gap-2 rounded-2xl border border-ink-200/70 bg-white p-4 text-sm text-ink-600">
        <span>
          {l.newHere}{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-brand-600 hover:text-brand-700">
            {l.createFamily} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
          </Link>
        </span>
        <span>
          {l.student}{" "}
          <Link href="/join" className="font-semibold text-brand-600 hover:text-brand-700">
            {l.joinCode} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>
          </Link>
        </span>
      </div>
    </>
  );
}
