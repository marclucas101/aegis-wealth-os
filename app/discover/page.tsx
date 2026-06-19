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
      title="Complete My Information"
      subtitle="Progressive financial profile for your adviser review"
    >
      <header className="mb-8 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-5 py-6 sm:mb-10 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Your financial profile
        </p>
        <h2 className="mt-2 text-xl font-light tracking-wide text-[#F3F1EA] sm:text-2xl">
          Organise your information step by step
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
          Five guided sections cover your household, finances, arrangements, and
          priorities. Your answers are reviewed by your assigned adviser — the
          platform does not provide unsupervised recommendations.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            "Save automatically as you go",
            "Return anytime to continue",
            "Submit when ready for adviser review",
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
