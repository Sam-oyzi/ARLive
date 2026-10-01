import Link from "next/link";
import { cn } from "@/lib/utils";

/** Scan-frame corners around an isometric cube: "point the camera, get 3D". */
export function LogoMark({ className }: { className?: string }) {
  // The gradient is CSS rather than an SVG <linearGradient>: several marks render per page and a
  // shared gradient id breaks when the first instance is hidden (e.g. the desktop sidebar on mobile).
  return (
    <span className={cn("inline-grid size-9 shrink-0 rounded-[30%] bg-gradient-to-br from-brand-400 to-brand-600", className)} aria-hidden>
      <svg viewBox="0 0 40 40" className="size-full">
        <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14v-3a2 2 0 0 1 2-2h3M26 9h3a2 2 0 0 1 2 2v3M31 26v3a2 2 0 0 1-2 2h-3M14 31h-3a2 2 0 0 1-2-2v-3" opacity=".75" />
          <path d="M20 12.5 26.5 16v8L20 27.5 13.5 24v-8L20 12.5Z" />
          <path d="M13.5 16 20 19.5 26.5 16M20 19.5v8" />
        </g>
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className, dark }: { href?: string; className?: string; dark?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-xl font-bold tracking-tight", dark ? "text-white" : "text-ink-900")}>
        AR<span className="text-brand-500">Live</span>
      </span>
    </Link>
  );
}
