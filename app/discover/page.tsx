import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import DiscoverWizard from "@/components/aegis/discover/DiscoverWizard";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DiscoverPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Discover™"
      subtitle="Build your financial profile — step by step"
    >
      <header className="mb-8 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-5 py-6 sm:mb-10 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Step 1 · Your profile
        </p>
        <h2 className="mt-2 text-xl font-light tracking-wide text-[#F3F1EA] sm:text-2xl">
          Tell us about your finances
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
          Eleven short sections cover income, protection, investments, and
          family — in everyday language. Your answers stay private and power
          your Shield score, roadmap, and reports.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            "About 15–20 minutes if you have figures handy",
            "Save progress as you go — return anytime",
            "Unlocks Shield Diagnostic when complete",
          ].map((item) => (
            <p
              key={item}
              className="rounded-sm border border-[#F3F1EA]/8 bg-[#071B2A]/40 px-3 py-2 text-xs font-light text-[#F3F1EA]/45"
            >
              {item}
            </p>
          ))}
        </div>
      </header>

      <DiscoverWizard />

      <div className="mt-8">
        <ClientTrustNotice variant="compact" context="general" />
      </div>
    </AuthenticatedAppShell>
  );
}
