import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.signUp };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t } = await getI18n();
  const u = t.auth.signup;
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">{u.title}</h1>
      <p className="mt-2 text-[15px] text-ink-500">{u.text}</p>
      <SignupForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-500">
        {u.already}{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand-600 hover:text-brand-700">
          {u.signIn}
        </Link>
      </p>
    </>
  );
}
