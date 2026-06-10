"use client";

interface ClientTrustNoticeProps {
  variant?: "compact" | "full";
  context?: "general" | "planning" | "documents" | "stress";
}

const COPY: Record<
  NonNullable<ClientTrustNoticeProps["context"]>,
  { title: string; body: string }
> = {
  general: {
    title: "Private & for planning support",
    body: "Your data stays in your secure AEGIS profile. Insights here support conversations with your advisor — they are not standalone financial advice.",
  },
  planning: {
    title: "Planning support, not advice",
    body: "Reports and scores help you and your advisor discuss options. They do not replace personalised advice on investments, tax, or legal matters.",
  },
  documents: {
    title: "Secure document storage",
    body: "Files are encrypted in your private vault and accessible only to you and advisors you authorise. Do not upload passwords or payment card numbers.",
  },
  stress: {
    title: "Illustrative scenarios",
    body: "Stress tests model hypothetical events to highlight vulnerabilities. Results are guides for discussion, not predictions of future outcomes.",
  },
};

export default function ClientTrustNotice({
  variant = "compact",
  context = "general",
}: ClientTrustNoticeProps) {
  const { title, body } = COPY[context];

  if (variant === "compact") {
    return (
      <p className="rounded-sm border border-[#F3F1EA]/8 bg-[#071B2A]/40 px-4 py-3 text-xs font-light leading-relaxed text-[#F3F1EA]/40">
        <span className="text-[#F3F1EA]/55">{title}. </span>
        {body}
      </p>
    );
  }

  return (
    <aside className="relative overflow-hidden rounded-sm border border-[#F3F1EA]/10 bg-[#071B2A]/50 p-5 sm:p-6">
      <div className="absolute left-0 top-0 h-full w-0.5 bg-emerald-500/40" />
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-400/80">
        Trust & clarity
      </p>
      <p className="mt-2 text-sm font-light text-[#F3F1EA]/70">{title}</p>
      <p className="mt-2 text-xs font-light leading-relaxed text-[#F3F1EA]/45">
        {body}
      </p>
    </aside>
  );
}
