import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Welcome back</h1>
      <p className="mt-2 text-[15px] text-ink-500">Sign in to your family account, or with the account your school gave you.</p>
      <LoginForm next={next} />
      <div className="mt-8 flex flex-col gap-2 rounded-2xl border border-ink-200/70 bg-white p-4 text-sm text-ink-600">
        <span>
          New here?{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-brand-600 hover:text-brand-700">
            Create a free family account →
          </Link>
        </span>
        <span>
          Student?{" "}
          <Link href="/join" className="font-semibold text-brand-600 hover:text-brand-700">
            Join with your school code →
          </Link>
        </span>
      </div>
    </>
  );
}
