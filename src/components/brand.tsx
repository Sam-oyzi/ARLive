import Link from "next/link";
import { cn } from "@/lib/utils";

/** A smiling sun rising out of an open book: stories that light up and come alive. */
export function LogoMark({ className }: { className?: string }) {
  // The sky is a CSS gradient rather than an SVG <linearGradient>: several marks render per page and a
  // shared gradient id breaks when the first instance is hidden (e.g. the desktop sidebar on mobile).
  return (
    <span className={cn("inline-grid size-9 shrink-0 rounded-[30%] bg-gradient-to-b from-sky-400 to-sky-600", className)} aria-hidden>
      <svg viewBox="0 0 40 40" className="size-full">
        <path d="M20 9.2v-2.6M26.2 11.6l1.7-1.9M13.8 11.6l-1.7-1.9M29.2 16.7l2.4-.8M10.8 16.7l-2.4-.8" stroke="#ffd23f" strokeWidth="2.3" strokeLinecap="round" />
        <circle cx="20" cy="18" r="6" fill="#ffd23f" />
        <circle cx="17.9" cy="17.2" r="0.95" fill="#7a3a0c" />
        <circle cx="22.1" cy="17.2" r="0.95" fill="#7a3a0c" />
        <path d="M17.6 19.6q2.4 2 4.8 0" fill="none" stroke="#7a3a0c" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M6.5 22.4c4.4-1.7 8.8-1.3 12.7 1.3v9.1c-3.9-2.4-8.3-2.8-12.7-1.2ZM33.5 22.4c-4.4-1.7-8.8-1.3-12.7 1.3v9.1c3.9-2.4 8.3-2.8 12.7-1.2Z" fill="#fff" />
        <path d="M6.5 31.6c4.4-1.6 8.8-1.2 12.7 1.2M33.5 31.6c-4.4-1.6-8.8-1.2-12.7 1.2" fill="none" stroke="#ff8c3a" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className, dark }: { href?: string; className?: string; dark?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-xl font-bold tracking-tight", dark ? "text-white" : "text-ink-900")}>
        Sketch<span className="text-brand-500">ling</span>
      </span>
    </Link>
  );
}
