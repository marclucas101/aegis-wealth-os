import AppShell from "@/components/aegis/AppShell";
import DiscoverWizard from "@/components/aegis/discover/DiscoverWizard";

export default function DiscoverPage() {
  return (
    <AppShell
      title="Discover™"
      subtitle="Financial profile architecture"
    >
      <header className="mb-8 border-b border-[#D1A866]/15 pb-6 sm:mb-10">
        <div className="max-w-3xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
            Module 1 · Wealth Architecture
          </p>
          <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
            Build your institutional financial profile through progressive,
            high-trust data capture. Discover establishes the foundation for
            Shield Diagnostic, benchmarking, and architecture decisions.
          </p>
        </div>
      </header>

      <DiscoverWizard />
    </AppShell>
  );
}
