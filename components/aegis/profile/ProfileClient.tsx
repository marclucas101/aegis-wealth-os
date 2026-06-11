"use client";

import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

import CallMyAdviserPanel from "@/components/aegis/adviser/CallMyAdviserPanel";
import ProfileStatusCard, {
  OnboardingBanner,
} from "@/components/aegis/profile/ProfileStatusCard";

type ProfileClientProps = {
  user: AppUserRow;
  client: AppClientRow;
};

export default function ProfileClient({ user, client }: ProfileClientProps) {
  const isOnboarding = client.status === "onboarding";

  return (
    <div className="relative max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-8 w-px bg-[#D1A866]/50" />
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/80">
          Phase 3F · Client Profile
        </p>
      </div>

      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/25 p-6 sm:p-8">
        <div className="mb-6 border-b border-[#D1A866]/10 pb-6">
          <h2 className="text-xl font-light tracking-wide text-[#F3F1EA]">
            {client.display_name}
          </h2>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            Authenticated client record
          </p>
        </div>

        <OnboardingBanner isOnboarding={isOnboarding} />

        <div className={`${isOnboarding ? "mt-6" : ""}`}>
          <ProfileStatusCard label="Email" value={user.email} />
          <ProfileStatusCard
            label="Display name"
            value={client.display_name}
          />
          <ProfileStatusCard
            label="Client status"
            value={client.status}
            status={client.status}
          />
          <ProfileStatusCard label="Client ID" value={client.id} mono />
          <ProfileStatusCard
            label="Onboarding"
            value={isOnboarding ? "In progress" : "Complete"}
          />
          <ProfileStatusCard label="Currency" value={client.currency_code} />
        </div>
      </div>

      <div className="mt-8">
        <CallMyAdviserPanel />
      </div>
    </div>
  );
}
