import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create a free account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Create a free account</h1>
      <p className="mt-2 text-[15px] text-ink-500">Save the books your family loves, rate them, and ask for stories made for your child.</p>
      <SignupForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
