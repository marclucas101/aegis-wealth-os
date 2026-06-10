import type { ReactNode } from "react";

type LegalNoticeVariant = "info" | "warning" | "neutral";

interface LegalNoticeCardProps {
  title: string;
  children: ReactNode;
  variant?: LegalNoticeVariant;
  className?: string;
}

const VARIANT_STYLES: Record<
  LegalNoticeVariant,
  { border: string; accent: string; title: string }
> = {
  info: {
    border: "border-emerald-500/20 bg-emerald-500/5",
    accent: "bg-emerald-500/40",
    title: "text-emerald-400/85",
  },
  warning: {
    border: "border-amber-500/25 bg-amber-500/8",
    accent: "bg-amber-500/40",
    title: "text-amber-400/90",
  },
  neutral: {
    border: "border-[#F3F1EA]/10 bg-[#071B2A]/50",
    accent: "bg-[#D1A866]/40",
    title: "text-[#D1A866]/80",
  },
};

export default function LegalNoticeCard({
  title,
  children,
  variant = "neutral",
  className = "",
}: LegalNoticeCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <aside
      className={`relative overflow-hidden rounded-sm border p-5 sm:p-6 ${styles.border} ${className}`}
    >
      <div className={`absolute left-0 top-0 h-full w-0.5 ${styles.accent}`} />
      <p
        className={`text-[10px] font-medium uppercase tracking-[0.18em] ${styles.title}`}
      >
        {title}
      </p>
      <div className="mt-3 space-y-2 text-xs font-light leading-relaxed text-[#F3F1EA]/50">
        {children}
      </div>
    </aside>
  );
}
