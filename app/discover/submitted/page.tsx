import Link from "next/link";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DiscoverSubmittedPage() {
  return (
    <AuthenticatedAppShell
      title="Submission received"
      subtitle="Your information is with your adviser"
    >
      <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-8 py-10 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-300/80">
          Submitted for adviser review
        </p>
        <h2 className="mt-3 text-2xl font-light text-[#F3F1EA]">
          Thank you — your profile has been submitted
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm font-light leading-relaxed text-[#F3F1EA]/55">
          Your assigned financial adviser will review your information and prepare
          for your advisory discussion. Aurelis does not provide personalised
          recommendations until your adviser has reviewed and published an
          approved summary.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/prospect"
            className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866]"
          >
            Return to home
          </Link>
          <Link
            href="/my-adviser"
            className="rounded-sm border border-[#D1A866]/20 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/65"
          >
            Book your review
          </Link>
        </div>
      </div>
      <div className="mt-8">
        <ClientTrustNotice variant="compact" context="general" />
      </div>
    </AuthenticatedAppShell>
  );
}
