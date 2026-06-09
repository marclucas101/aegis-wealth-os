import type { ClientStatus } from "@/lib/supabase/userProfile";

const STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: "Prospect",
  onboarding: "Onboarding",
  active: "Active",
  review_due: "Review Due",
  archived: "Archived",
};

const STATUS_STYLES: Record<ClientStatus, string> = {
  prospect: "border-[#F3F1EA]/15 bg-[#F3F1EA]/5 text-[#F3F1EA]/55",
  onboarding: "border-[#D1A866]/35 bg-[#D1A866]/10 text-[#D1A866]",
  active: "border-emerald-400/25 bg-emerald-950/30 text-emerald-300/90",
  review_due: "border-amber-400/25 bg-amber-950/30 text-amber-300/90",
  archived: "border-[#F3F1EA]/10 bg-[#10283A]/40 text-[#F3F1EA]/35",
};

type ProfileStatusCardProps = {
  label: string;
  value: string;
  mono?: boolean;
  status?: ClientStatus;
};

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#D1A866]/8 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
        {label}
      </span>
      <span
        className={`text-sm font-light text-[#F3F1EA]/85 ${
          mono ? "font-mono text-xs tracking-wide text-[#F3F1EA]/65" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function ProfileStatusCard({
  label,
  value,
  mono = false,
  status,
}: ProfileStatusCardProps) {
  if (status) {
    return (
      <div className="flex flex-col gap-2 border-b border-[#D1A866]/8 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
          {label}
        </span>
        <span
          className={`inline-flex w-fit items-center rounded-sm border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
    );
  }

  return <DetailRow label={label} value={value} mono={mono} />;
}

export function OnboardingBanner({ isOnboarding }: { isOnboarding: boolean }) {
  if (!isOnboarding) {
    return null;
  }

  return (
    <div className="rounded-sm border border-[#D1A866]/20 bg-[#D1A866]/5 px-5 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/80">
        Onboarding in progress
      </p>
      <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/60">
        Your client record is active. Complete Discover to move from onboarding
        to a full wealth architecture profile.
      </p>
    </div>
  );
}
