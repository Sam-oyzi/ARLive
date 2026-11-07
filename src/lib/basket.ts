"use client";

// The reader's basket of printed books to order. It lives in this browser only (no account needed),
// and ordering sends it as a WhatsApp message; nothing is paid in the app.
import { useSyncExternalStore } from "react";

export type BasketItem = { bookId: string; title: string; imageUrl: string | null; copies: number };

const KEY = "pagewakes-basket";
const EVENT = "pagewakes-basket";
export const MAX_COPIES = 999;

let cachedRaw: string | null = null;
let cached: BasketItem[] = [];
const EMPTY: BasketItem[] = [];

function read(): BasketItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // private mode or blocked storage: an empty basket
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed)
      ? parsed.filter((item): item is BasketItem => typeof item?.bookId === "string" && typeof item?.title === "string" && Number.isFinite(item?.copies))
      : [];
  } catch {
    cached = [];
  }
  return cached;
}

function write(items: BasketItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked: the basket stays as it was
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  // Other tabs change it through "storage"; this tab through our own event.
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useBasket(): BasketItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Puts a book in the basket (once: how many copies is chosen in the basket). */
export function addToBasket(book: Omit<BasketItem, "copies">) {
  const items = read();
  const existing = items.find((item) => item.bookId === book.bookId);
  write(existing ? items : [...items, { ...book, copies: 1 }]);
}

export function setCopies(bookId: string, copies: number) {
  const next = Math.max(1, Math.min(MAX_COPIES, Math.round(copies) || 1));
  write(read().map((item) => (item.bookId === bookId ? { ...item, copies: next } : item)));
}

export function removeFromBasket(bookId: string) {
  write(read().filter((item) => item.bookId !== bookId));
}

export function clearBasket() {
  write([]);
}

/** The WhatsApp message listing the order, ready to send. */
export function orderMessage(items: BasketItem[], origin: string, organisation: string): string {
  const lines = items.map((item) => `• ${item.title} × ${item.copies}\n  ${origin}/library/${item.bookId}`);
  const copies = items.reduce((sum, item) => sum + item.copies, 0);
  return [
    "Hello PageWakes! I'd like to order printed books:",
    "",
    ...lines,
    "",
    `Total: ${copies} ${copies === 1 ? "copy" : "copies"}`,
    ...(organisation.trim() ? [`For: ${organisation.trim()}`] : []),
  ].join("\n");
}

/** A wa.me link from a phone number in any format (digits and an optional leading +). */
export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
