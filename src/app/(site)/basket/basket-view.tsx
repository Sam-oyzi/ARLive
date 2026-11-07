"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Thumb } from "@/components/thumb";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { addToBasket, MAX_COPIES, orderMessage, removeFromBasket, setCopies, useBasket, whatsappLink, type BasketItem } from "@/lib/basket";

export function BasketView({ adding, whatsapp, origin }: { adding: Omit<BasketItem, "copies"> | null; whatsapp: string | null; origin: string }) {
  const router = useRouter();
  const items = useBasket();
  const [ready, setReady] = useState(false);
  const [organisation, setOrganisation] = useState("");

  // A "Buy" button brought the reader here: put the book in, then tidy the address.
  useEffect(() => {
    if (adding) {
      addToBasket(adding);
      router.replace("/basket", { scroll: false });
    }
    setReady(true);
  }, [adding, router]);

  const copies = items.reduce((sum, item) => sum + item.copies, 0);
  const message = orderMessage(items, origin, organisation);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-20 sm:px-6">
      <Link href="/library" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft aria-hidden="true" className="size-4" /> Library
      </Link>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-900">Your basket</h1>
      <p className="mt-2 max-w-xl text-pretty text-ink-600">
        Printed books are made to order, for schools, shops and families. Send us your list on WhatsApp and we&apos;ll reply with the
        price and delivery. Nothing is paid here.
      </p>

      {!ready ? (
        <div className="mt-8 h-40 animate-pulse rounded-3xl bg-white/70" />
      ) : items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-[#eadfca]">
          <ShoppingBasket aria-hidden="true" className="size-10 text-ink-300" />
          <p className="mt-3 font-semibold text-ink-800">Your basket is empty</p>
          <p className="mt-1 text-sm text-ink-500">Find a book you love and tap Buy printed book.</p>
          <ButtonLink href="/library" className="mt-5">
            Browse the library
          </ButtonLink>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-[#eadfca] overflow-hidden rounded-3xl bg-white ring-1 ring-[#eadfca]">
            {items.map((item) => (
              <li key={item.bookId} className="flex items-center gap-4 p-4">
                <Link href={`/library/${item.bookId}`} className="w-14 shrink-0 overflow-hidden rounded-xl bg-[#f3ead8] ring-1 ring-ink-900/5">
                  {item.imageUrl && <Thumb src={item.imageUrl} alt="" width={112} height={150} className="aspect-[3/4] w-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/library/${item.bookId}`} className="line-clamp-2 font-semibold text-ink-900 hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-sm text-ink-500">Printed book</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-[#f6efe1] p-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`One copy fewer of ${item.title}`} disabled={item.copies <= 1} onClick={() => setCopies(item.bookId, item.copies - 1)}>
                    <Minus />
                  </Button>
                  <input
                    aria-label={`Copies of ${item.title}`}
                    inputMode="numeric"
                    value={item.copies}
                    onChange={(event) => setCopies(item.bookId, Number(event.target.value.replace(/\D/g, "")))}
                    className="w-12 bg-transparent text-center font-semibold text-ink-900 tabular-nums outline-none"
                  />
                  <Button variant="ghost" size="icon-sm" aria-label={`One more copy of ${item.title}`} disabled={item.copies >= MAX_COPIES} onClick={() => setCopies(item.bookId, item.copies + 1)}>
                    <Plus />
                  </Button>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.title}`} onClick={() => removeFromBasket(item.bookId)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[#eadfca]">
            <Field label="School, shop or organisation (optional)" htmlFor="organisation">
              <Input id="organisation" value={organisation} onChange={(event) => setOrganisation(event.target.value)} placeholder="e.g. Green Valley School" />
            </Field>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink-700">
                {copies} {copies === 1 ? "copy" : "copies"} · {items.length} {items.length === 1 ? "book" : "books"}
              </p>
              {whatsapp ? (
                <a
                  href={whatsappLink(whatsapp, message)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#25D366] px-5 font-bold text-white shadow-lift transition hover:bg-[#1ebe5a]"
                >
                  <WhatsAppIcon /> Order on WhatsApp
                </a>
              ) : (
                <p className="text-sm text-ink-500">Ordering on WhatsApp opens soon.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35ZM12.05 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.46 9.48-9.46a9.4 9.4 0 0 1 6.69 2.78 9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.46 9.46Zm8.05-17.51A11.32 11.32 0 0 0 12.05.66C5.78.66.67 5.76.67 12.03c0 2 .52 3.96 1.52 5.69L.57 23.66l6.08-1.6a11.37 11.37 0 0 0 5.4 1.38h.01c6.27 0 11.38-5.1 11.38-11.38 0-3.04-1.18-5.9-3.34-8.06Z" />
    </svg>
  );
}
