import AppShell from "@/components/aegis/AppShell";
import ShieldDiagnosticClient from "@/components/aegis/shield/ShieldDiagnosticClient";

export default function ShieldDiagnosticPage() {
  return (
    <AppShell
      title="Shield Diagnostic™"
      subtitle="Composite shield assessment"
    >
      <header className="mb-8 border-b border-[#D1A866]/15 pb-6 sm:mb-10">
        <div className="max-w-3xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
            Module 2 · Shield Architecture
          </p>
          <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
            Preliminary composite assessment derived from your Discover™ profile.
            Pillar scores use mapped financial inputs and adjust via the Data
            Confidence Factor™.
          </p>
        </div>
      </header>

      <ShieldDiagnosticClient />
    </AppShell>
  );
}
