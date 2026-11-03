import { SiteFooter, SiteHeader } from "@/components/site-header";

/** The public site: home, library, book pages, custom stories and the parent's account. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#fbf7ef]">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
