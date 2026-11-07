"use client";

import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { useBasket } from "@/lib/basket";
import { cn } from "@/lib/utils";

/** The header's basket, with how many printed books are in it. */
export function BasketLink({ className }: { className?: string }) {
  const items = useBasket();
  const copies = items.reduce((sum, item) => sum + item.copies, 0);
  return (
    <Link
      href="/basket"
      aria-label={copies ? `Basket, ${copies} printed ${copies === 1 ? "book" : "books"}` : "Basket"}
      className={cn("relative grid size-10 place-items-center rounded-xl text-ink-600 transition hover:bg-white/70 hover:text-ink-900", className)}
    >
      <ShoppingBasket aria-hidden="true" className="size-5" />
      {copies > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-[#176052] px-1 text-[11px] font-bold text-white tabular-nums ring-2 ring-[#fbf7ef]">
          {copies > 99 ? "99+" : copies}
        </span>
      )}
    </Link>
  );
}
