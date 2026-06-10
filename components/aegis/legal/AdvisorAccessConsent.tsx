import Link from "next/link";

interface AdvisorAccessConsentProps {
  variant?: "inline" | "card";
  className?: string;
}

export default function AdvisorAccessConsent({
  variant = "card",
  className = "",
}: AdvisorAccessConsentProps) {
  const body = (
    <>
      <p>
        Assigned advisors may review your profile, scores, uploaded documents,
        notes, tasks, generated reports, and related planning information to
        support advisor-reviewed conversations.
      </p>
      <p className="mt-2">
        Admin users may manage access, assignments, and platform configuration.
        Access is role-based and limited to what your account permissions allow.
      </p>
    </>
  );

  if (variant === "inline") {
    return (
      <p
        className={`text-xs font-light leading-relaxed text-[#F3F1EA]/40 ${className}`}
      >
        {body}{" "}
        <Link
          href="/legal/consent"
          className="text-[#D1A866]/60 underline-offset-2 hover:text-[#D1A866] hover:underline"
        >
          Consent overview
        </Link>
      </p>
    );
  }

  return (
    <aside
      className={`rounded-sm border border-[#F3F1EA]/10 bg-[#071B2A]/40 px-4 py-3 ${className}`}
      role="note"
      aria-label="Advisor access consent"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/75">
        Advisor & admin access
      </p>
      <div className="mt-2 text-xs font-light leading-relaxed text-[#F3F1EA]/45">
        {body}
      </div>
      <p className="mt-2 text-[10px] font-light text-[#F3F1EA]/35">
        <Link
          href="/legal/consent"
          className="text-[#D1A866]/60 underline-offset-2 hover:text-[#D1A866] hover:underline"
        >
          Client consent overview
        </Link>
      </p>
    </aside>
  );
}
