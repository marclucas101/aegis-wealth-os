import Link from "next/link";

import {
  PLANNING_SUPPORT_DISCLAIMER,
  REPORT_DISCLAIMER_PARAGRAPHS,
} from "@/lib/aegis/legal";

interface ReportDisclaimerBlockProps {
  variant?: "screen" | "compact";
  className?: string;
}

export default function ReportDisclaimerBlock({
  variant = "screen",
  className = "",
}: ReportDisclaimerBlockProps) {
  if (variant === "compact") {
    return (
      <p
        className={`text-xs font-light leading-relaxed text-[#F3F1EA]/40 ${className}`}
      >
        {PLANNING_SUPPORT_DISCLAIMER}{" "}
        <Link
          href="/legal/disclaimer"
          className="text-[#D1A866]/60 underline-offset-2 hover:text-[#D1A866] hover:underline"
        >
          Full disclaimer
        </Link>
      </p>
    );
  }

  return (
    <section
      className={`rounded-sm border border-[#F3F1EA]/10 bg-[#071B2A]/50 p-5 sm:p-6 ${className}`}
      aria-label="Report disclaimer"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/75">
        Important notice
      </p>
      {REPORT_DISCLAIMER_PARAGRAPHS.map((paragraph) => (
        <p
          key={paragraph.slice(0, 40)}
          className="mt-3 text-xs font-light leading-relaxed text-[#F3F1EA]/50"
        >
          {paragraph}
        </p>
      ))}
      <p className="mt-3 text-[10px] font-light text-[#F3F1EA]/35">
        Consult a qualified professional before acting on any output.{" "}
        <Link
          href="/legal/disclaimer"
          className="text-[#D1A866]/60 underline-offset-2 hover:text-[#D1A866] hover:underline"
        >
          Financial planning disclaimer
        </Link>
      </p>
    </section>
  );
}
