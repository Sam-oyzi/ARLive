"use client";

import { Clock, Heart, Lock, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runAction } from "@/lib/action-client";
import { cn, compactNumber } from "@/lib/utils";
import { buttonClasses, Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import type { Access } from "@/lib/books";
import type { Visibility } from "@/lib/visibility";
import { rateBook, toggleLike } from "@/server/actions/library";
import { requestBookAccess } from "@/server/actions/readers";

/** Sends visitors to sign in (and back here) before they can like or rate. */
function useSignInFirst(bookId: string, signedIn: boolean) {
  const router = useRouter();
  return () => {
    if (signedIn) return false;
    router.push(`/login?next=${encodeURIComponent(`/library/${bookId}`)}`);
    return true;
  };
}

export function LikeButton({ bookId, liked: initialLiked, likes: initialLikes, signedIn }: { bookId: string; liked: boolean; likes: number; signedIn: boolean }) {
  const [state, setState] = useState({ liked: initialLiked, likes: initialLikes });
  const [pending, start] = useTransition();
  const signInFirst = useSignInFirst(bookId, signedIn);

  return (
    <button
      type="button"
      aria-pressed={state.liked}
      disabled={pending}
      onClick={() => {
        if (signInFirst()) return;
        const previous = state;
        setState({ liked: !state.liked, likes: state.likes + (state.liked ? -1 : 1) });
        start(async () => {
          const result = await runAction(toggleLike(bookId));
          setState(result?.data ?? previous);
        });
      }}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-2xl border px-5 text-base font-semibold transition",
        state.liked ? "border-rose-200 bg-rose-50 text-rose-600" : "border-ink-200 bg-white text-ink-700 hover:border-rose-200 hover:text-rose-600",
      )}
    >
      <Heart aria-hidden="true" className={cn("size-5 transition", state.liked && "scale-110")} fill={state.liked ? "currentColor" : "none"} />
      {state.liked ? "Liked" : "Like"}
      <span className="text-sm font-medium tabular-nums opacity-70">{compactNumber(state.likes)}</span>
    </button>
  );
}

export function RatingInput({ bookId, mine, signedIn }: { bookId: string; mine: number | null; signedIn: boolean }) {
  const [value, setValue] = useState(mine ?? 0);
  const [hover, setHover] = useState(0);
  const [pending, start] = useTransition();
  const signInFirst = useSignInFirst(bookId, signedIn);
  const shown = hover || value;

  return (
    <div>
      <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((stars) => (
          <button
            key={stars}
            type="button"
            role="radio"
            aria-checked={value === stars}
            aria-label={`${stars} star${stars === 1 ? "" : "s"}`}
            disabled={pending}
            onMouseEnter={() => setHover(stars)}
            onFocus={() => setHover(stars)}
            onBlur={() => setHover(0)}
            onClick={() => {
              if (signInFirst()) return;
              const previous = value;
              setValue(stars);
              start(async () => {
                const result = await runAction(rateBook(bookId, stars));
                if (!result?.ok) setValue(previous);
              });
            }}
            className="rounded-md p-0.5 transition hover:scale-110"
          >
            <Star aria-hidden="true" className={cn("size-7", stars <= shown ? "text-amber-400" : "text-ink-200")} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-500">{!signedIn ? "Sign in to rate this story" : value ? "Your rating · tap to change" : "Tap a star to rate"}</p>
    </div>
  );
}

/** Shown instead of Read / Scan / Download when the viewer can't open the book yet. */
export function AccessPanel({ bookId, access, visibility }: { bookId: string; access: Exclude<Access, "open">; visibility: Visibility }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const here = encodeURIComponent(`/library/${bookId}`);

  return (
    <div className="mt-8 max-w-2xl rounded-[24px] bg-white p-5 ring-1 ring-[#eadfca] sm:p-6">
      <p className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
        {access === "pending" ? <Clock aria-hidden="true" className="size-5 text-amber-500" /> : <Lock aria-hidden="true" className="size-5 text-brand-500" />}
        {access === "sign-in" && (visibility === "MEMBERS" ? "Free with an account" : "For approved readers")}
        {access === "request" && "Ask to read this book"}
        {access === "pending" && "Access requested"}
        {access === "declined" && "Your request wasn't approved"}
      </p>
      <p className="mt-1.5 text-[15px] text-ink-600">
        {access === "sign-in" &&
          (visibility === "MEMBERS"
            ? "Sign in or create a free account to read, download and scan this story."
            : "Sign in with your email, then ask for access. Bought the printed book? We'll approve your email.")}
        {access === "request" && "We'll check your request and let you know. Tell us where you got the book if you bought it."}
        {access === "pending" && "We'll approve it soon. The book opens here as soon as it is."}
        {access === "declined" && "You can ask again if something changed, for example after buying the book."}
      </p>

      {access === "sign-in" && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/login?next=${here}`} className={buttonClasses("primary", "lg")}>
            Sign in to read
          </Link>
          <Link href={`/signup?next=${here}`} className={buttonClasses("outline", "lg")}>
            Create a free account
          </Link>
        </div>
      )}

      {(access === "request" || access === "declined") && (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await runAction(requestBookAccess(bookId, message));
              if (result?.ok) router.refresh();
            });
          }}
        >
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={300}
            aria-label="Message for the team (optional)"
            placeholder="Optional: I bought the printed book at…"
            className="min-h-20"
          />
          <Button type="submit" size="lg" disabled={pending} className="self-start">
            {access === "declined" ? "Ask again" : "Ask for access"}
          </Button>
        </form>
      )}
    </div>
  );
}
