import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join your school" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Join your school</h1>
      <p className="mt-2 text-[15px] text-ink-500">Enter the code your teacher shared to create your student account.</p>
      <JoinForm code={code} />
      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
