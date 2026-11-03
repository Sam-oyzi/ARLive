"use client";

import { Heart, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runAction } from "@/lib/action-client";
import { compactNumber } from "@/lib/library";
import { cn } from "@/lib/utils";
import { rateBook, toggleLike } from "@/server/actions/library";

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
