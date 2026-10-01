import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Box,
  Camera,
  Globe,
  Layers,
  Lock,
  School,
  Smartphone,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { PhoneMockup } from "@/components/phone-mockup";
import { ButtonLink } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { SubjectIcon } from "@/lib/subject-icons";

const SUBJECTS = [
  { name: "Chemistry", icon: "flask", color: "#8b5cf6" },
  { name: "Biology", icon: "dna", color: "#10b981" },
  { name: "Physics", icon: "atom", color: "#3b82f6" },
  { name: "Geography", icon: "earth", color: "#0ea5e9" },
  { name: "History", icon: "landmark", color: "#f59e0b" },
  { name: "Astronomy", icon: "orbit", color: "#6366f1" },
  { name: "Mathematics", icon: "sigma", color: "#ec4899" },
  { name: "Anatomy", icon: "heart", color: "#ef4444" },
  { name: "Engineering", icon: "cpu", color: "#14b8a6" },
  { name: "Botany", icon: "leaf", color: "#84cc16" },
];

const FEATURES = [
  { icon: Wand2, title: "AR studio for your team", text: "Upload book pages, drop in GLB models, videos, images, audio and labels, then place them on the page in a live 3D editor." },
  { icon: Zap, title: "Live, no app to install", text: "Students open a link in Chrome or Safari. Publish a change and every classroom gets it instantly." },
  { icon: Lock, title: "Per-school access", text: "Decide exactly which subjects and books each school receives. Schools request more from the catalog." },
  { icon: Box, title: "Animated 3D that looks real", text: "Physically-based lighting, contact shadows and animation clips. Students spin and pinch to explore." },
  { icon: BarChart3, title: "Usage analytics", text: "See scans per day, the most explored books and the most curious students, per school and overall." },
  { icon: Layers, title: "Many pages per book", text: "Every page of a book compiles into one tracking file. Students scan any page and the right model appears." },
];

export default async function Landing() {
  const session = await getSession();
  const appHref = session ? homeFor(session.role) : "/login";

  return (
    <div className="overflow-x-clip">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo dark />
          <nav className="flex items-center gap-2">
            <a href="#how" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:text-white sm:block">
              How it works
            </a>
            <a href="#schools" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:text-white sm:block">
              For schools
            </a>
            <ButtonLink href={appHref} size="sm" className="bg-white text-ink-950 shadow-none hover:bg-white/90">
              {session ? "Open app" : "Sign in"} <ArrowRight />
            </ButtonLink>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden bg-ink-950 pt-28 pb-20 text-white sm:pt-36">
        <div className="absolute inset-0 bg-grid-dark [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 size-[720px] -translate-x-1/2 rounded-full bg-brand-500/35 blur-[140px]" />
        <div className="absolute top-60 -right-40 size-[420px] rounded-full bg-fuchsia-500/20 blur-[120px]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
              <Sparkles className="size-3.5 text-brand-300" /> Augmented reality for every subject
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Point. Scan.
              <br />
              <span className="bg-gradient-to-r from-brand-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">Watch it come alive.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/65 lg:mx-0">
              ARLive turns printed textbooks into interactive 3D lessons. Students aim their phone at a page — a molecule, a heart, a
              volcano rises from the paper.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <ButtonLink href={appHref} size="lg" className="shadow-glow">
                <Camera /> {session ? "Open ARLive" : "Sign in to start"}
              </ButtonLink>
              <ButtonLink href="/join" size="lg" variant="outline" className="border-white/15 bg-white/5 text-white shadow-none hover:bg-white/10 hover:text-white">
                I have a school code
              </ButtonLink>
            </div>
            <div className="mt-10 flex items-center justify-center gap-6 text-sm text-white/50 lg:justify-start">
              <span className="flex items-center gap-2">
                <Globe className="size-4" /> Runs in the browser
              </span>
              <span className="flex items-center gap-2">
                <Smartphone className="size-4" /> Android & iPhone
              </span>
            </div>
          </div>

          <div className="relative flex justify-center">
            <PhoneMockup color="#8b5cf6" icon="flask" found={{ title: "Water molecule · H₂O", subtitle: "Chemistry · page 12" }} />
            {[
              { name: "Biology", icon: "dna", color: "#10b981", cls: "top-10 -left-2 sm:left-4" },
              { name: "Physics", icon: "atom", color: "#3b82f6", cls: "top-1/2 -right-2 sm:right-0" },
              { name: "Geography", icon: "earth", color: "#0ea5e9", cls: "bottom-16 left-0 sm:left-6" },
            ].map((chip, i) => (
              <span
                key={chip.name}
                className={`absolute ${chip.cls} flex animate-float items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-lift ring-1 ring-white/15 backdrop-blur-xl`}
                style={{ animationDelay: `${i * 0.8}s` }}
              >
                <span className="grid size-7 place-items-center rounded-lg" style={{ background: chip.color }}>
                  <SubjectIcon icon={chip.icon} className="size-4" />
                </span>
                {chip.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* subjects marquee */}
      <section className="border-y border-ink-200/70 bg-white py-6">
        <div className="flex gap-3 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex shrink-0 animate-[marquee_40s_linear_infinite] gap-3">
            {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
              <span key={i} className="flex shrink-0 items-center gap-2.5 rounded-full border border-ink-200/70 bg-ink-50 py-1.5 pr-4 pl-1.5 text-sm font-semibold text-ink-700">
                <span className="grid size-7 place-items-center rounded-full text-white" style={{ background: s.color }}>
                  <SubjectIcon icon={s.icon} className="size-3.5" />
                </span>
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* how */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink-900">Three taps from page to 3D</h2>
          <p className="mt-4 text-lg text-ink-500">No markers to print, no app store. The book itself is the trigger.</p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            { icon: BookOpen, title: "Choose a subject", text: "Students see only the subjects and books their school unlocked: Chemistry, Biology, History…" },
            { icon: Camera, title: "Scan any page", text: "Point the phone at a page of the book. ARLive recognises it in a fraction of a second." },
            { icon: Box, title: "Explore in 3D", text: "Models, animations, videos and narration appear on the page. Spin, zoom, replay, take a photo." },
          ].map((step, i) => (
            <div key={step.title} className="relative rounded-[28px] border border-ink-200/70 bg-white p-7 shadow-soft">
              <span className="absolute top-6 right-7 font-display text-6xl font-bold text-ink-100">{i + 1}</span>
              <span className="relative grid size-12 place-items-center rounded-2xl bg-brand-500 text-white shadow-glow">
                <step.icon className="size-6" />
              </span>
              <h3 className="relative mt-6 font-display text-xl font-bold text-ink-900">{step.title}</h3>
              <p className="relative mt-2 text-[15px] leading-relaxed text-ink-500">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="schools" className="scroll-mt-20 bg-ink-950 py-24 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold text-brand-300">For schools & publishers</span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">One platform. Every subject. Every school.</h2>
            <p className="mt-4 text-lg text-white/60">
              Your team builds the AR content once; you choose which schools get which books; students scan from any phone.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] bg-white/10 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-ink-950 p-7">
                <f.icon className="size-6 text-brand-300" />
                <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/55">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-brand-500 to-brand-800 px-8 py-14 text-center text-white shadow-glow sm:px-16">
          <div className="absolute inset-0 bg-grid-dark opacity-60" />
          <div className="relative">
            <School className="mx-auto size-10 text-white/80" />
            <h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold tracking-tight">Bring augmented reality to your school</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
              Students join with your school code in seconds. Teachers see who&apos;s exploring and which pages spark curiosity.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/join" size="lg" className="bg-white text-brand-700 shadow-none hover:bg-white/90">
                Join with a school code
              </ButtonLink>
              <ButtonLink href="/login" size="lg" variant="outline" className="border-white/30 bg-transparent text-white shadow-none hover:bg-white/10 hover:text-white">
                Staff sign in
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-200/70 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <Logo />
          <p className="text-sm text-ink-500">© {new Date().getFullYear()} ARLive. Built on MindAR image tracking.</p>
          <Link href="/login" className="text-sm font-semibold text-ink-600 hover:text-ink-900">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
