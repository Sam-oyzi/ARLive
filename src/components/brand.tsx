import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image src="/icon.svg" alt="" width={48} height={48} unoptimized className={cn("size-9 shrink-0", className)} />
  );
}

export function Logo({ href = "/", className, dark }: { href?: string; className?: string; dark?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-xl font-bold tracking-tight", dark ? "text-white" : "text-ink-900")}>
        Page<span className={dark ? "text-amber-300" : "text-[#176052]"}>Wakes</span>
      </span>
    </Link>
  );
}
