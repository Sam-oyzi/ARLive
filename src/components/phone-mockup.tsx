import type { CSSProperties, ReactNode } from "react";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

/**
 * A phone "looking at" a textbook page, with a 3D object floating above it.
 * Pure CSS so it renders instantly on the server; used on the landing, login and subject pages.
 */
export function PhoneMockup({
  color = "#5b5bf6",
  icon = "atom",
  caption = "Point your camera at a page",
  found,
  className,
  children,
}: {
  color?: string;
  icon?: string;
  caption?: string;
  found?: { title: string; subtitle?: string };
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative mx-auto w-[260px] shrink-0 select-none", className)}
      style={{ "--accent": color } as CSSProperties}
    >
      {/* glow */}
      <div className="absolute inset-8 -z-10 rounded-full bg-[var(--accent)] opacity-30 blur-3xl" />
      <div className="relative aspect-[9/19] rounded-[46px] bg-ink-950 p-[10px] shadow-[0_40px_80px_-20px_rgb(22_22_36/0.45),inset_0_0_0_1.5px_rgb(255_255_255/0.12)]">
        {/* side buttons */}
        <span className="absolute top-28 -left-[3px] h-10 w-[3px] rounded-l bg-ink-800" />
        <span className="absolute top-40 -left-[3px] h-14 w-[3px] rounded-l bg-ink-800" />
        <span className="absolute top-36 -right-[3px] h-20 w-[3px] rounded-r bg-ink-800" />

        <div className="relative h-full overflow-hidden rounded-[37px] bg-[#2a2622]">
          {/* camera feed: a desk with the book on it */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_100%,#6b5847_0%,#3a302a_55%,#221d1a_100%)]" />

          {/* the book page in perspective */}
          <div className="absolute inset-x-0 top-[34%] flex justify-center [perspective:600px]">
            <div className="relative h-[210px] w-[160px] origin-bottom rounded-md bg-[#fbf8f1] p-3 shadow-[0_30px_40px_-10px_rgb(0_0_0/0.6)] [transform:rotateX(38deg)]">
              <div className="mb-2 h-2 w-16 rounded bg-ink-800/80" />
              <div
                className="mb-2 grid h-[72px] place-items-center rounded"
                style={{ background: `linear-gradient(135deg, ${color}33, ${color}66)` }}
              >
                <SubjectIcon icon={icon} className="size-8 opacity-60" />
              </div>
              {[100, 92, 96, 70, 88, 94, 60].map((w, i) => (
                <div key={i} className="mb-1.5 h-1 rounded bg-ink-300" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>

          {/* floating 3D object */}
          <div className="absolute inset-x-0 top-[17%] flex justify-center">
            <div className="relative animate-float">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-[var(--accent)]" />
              <div
                className="relative grid size-24 place-items-center rounded-full text-white shadow-[0_20px_40px_-8px_rgb(0_0_0/0.6)]"
                style={{
                  background: `radial-gradient(circle at 32% 28%, #ffffffcc 0%, ${color} 38%, color-mix(in oklab, ${color} 55%, black) 100%)`,
                }}
              >
                <SubjectIcon icon={icon} className="size-11 drop-shadow-[0_2px_6px_rgb(0_0_0/0.35)]" />
              </div>
              <div className="mx-auto mt-5 h-3 w-16 rounded-[50%] bg-black/40 blur-[6px]" />
            </div>
          </div>

          {/* scan frame */}
          {!found && (
            <div className="absolute inset-x-8 top-[30%] bottom-[22%]">
              {["top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl", "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl", "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl", "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-2xl"].map((pos) => (
                <span key={pos} className={cn("absolute size-7 border-white/90", pos)} />
              ))}
              <span className="absolute inset-x-2 h-0.5 animate-scan rounded-full bg-[var(--accent)] shadow-[0_0_16px_4px_var(--accent)]" />
            </div>
          )}

          {/* status bar + island */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-7 pt-3.5 text-[10px] font-semibold text-white/90">
            <span>9:41</span>
            <span className="flex gap-1">
              <span className="h-2 w-3 rounded-sm bg-white/80" />
              <span className="h-2 w-4 rounded-sm bg-white/80" />
            </span>
          </div>
          <div className="absolute top-2.5 left-1/2 h-[22px] w-[76px] -translate-x-1/2 rounded-full bg-black" />

          {/* bottom UI */}
          <div className="absolute inset-x-3 bottom-4">
            {found ? (
              <div className="rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="text-[11px] font-semibold tracking-wide uppercase" style={{ color }}>
                  Recognised
                </div>
                <div className="font-display text-sm font-bold text-ink-900">{found.title}</div>
                {found.subtitle && <div className="text-[11px] text-ink-500">{found.subtitle}</div>}
              </div>
            ) : (
              <div className="mx-auto w-fit rounded-full bg-black/55 px-3.5 py-2 text-[11px] font-semibold text-white backdrop-blur">
                {caption}
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
