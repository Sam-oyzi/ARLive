import { Logo } from "@/components/brand";
import { PhoneMockup } from "@/components/phone-mockup";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>
        <p className="text-xs text-ink-400">© {new Date().getFullYear()} PageWakes · Illustrated stories for kids</p>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-b from-sky-500 to-sky-700 lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-amber-300/50 blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-brand-400/35 blur-[120px]" />
        <div className="relative flex flex-col items-center gap-10 px-12 text-center">
          <PhoneMockup color="#f26a1a" icon="droplets" found={{ title: "Lou the Water Drop", subtitle: "The Journey of a Water Drop" }} />
          <div className="max-w-md">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white">Stories that jump off the page.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/90">
              Read free picture books on any screen, print them at home, and scan the pages to meet the characters in 3D.
              Or ask for a story written just for your child.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
