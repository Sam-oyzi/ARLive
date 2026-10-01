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
        <p className="text-xs text-ink-400">© {new Date().getFullYear()} ARLive · Augmented reality for every classroom</p>
      </div>

      <div className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-500/40 blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-fuchsia-500/25 blur-[120px]" />
        <div className="relative flex flex-col items-center gap-10 px-12 text-center">
          <PhoneMockup color="#10b981" icon="dna" found={{ title: "DNA double helix", subtitle: "Biology · Chapter 3, page 42" }} />
          <div className="max-w-md">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white">Every page can come alive.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/60">
              Students point their phone at the textbook and explore molecules, organs, planets and monuments in 3D —
              right on the desk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
