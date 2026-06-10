"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ProfileCurrentResponse } from "@/app/api/profile/current/route";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

import ProfileStatusCard, {
  OnboardingBanner,
} from "@/components/aegis/profile/ProfileStatusCard";

type ProfileMode = "loading" | "ready" | "auth_required" | "error";

export default function ProfileClient() {
  const [mode, setMode] = useState<ProfileMode>("loading");
  const [user, setUser] = useState<AppUserRow | null>(null);
  const [client, setClient] = useState<AppClientRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile/current", {
          cache: "no-store",
        });

        if (response.status === 401) {
          if (!cancelled) {
            setMode("auth_required");
            setUser(null);
            setClient(null);
          }
          return;
        }

        const data = (await response.json()) as ProfileCurrentResponse;

        if (!data.ok) {
          throw new Error(data.error);
        }

        if (!cancelled) {
          setUser(data.user);
          setClient(data.client);
          setMode("ready");
          setLoadError(null);
        }
      } catch (err) {
        if (cancelled) return;
        setMode("error");
        setLoadError(
          err instanceof Error ? err.message : "Unable to load profile.",
        );
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-16 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">Loading profile…</p>
      </div>
    );
  }

  if (mode === "auth_required") {
    return (
      <div className="rounded-sm border border-[#D1A866]/20 bg-[#10283A]/50 p-8 text-center sm:p-12">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Sign in required
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA]">
          Sign in to view your profile
        </h2>
        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          Your account and client record are available once you sign in to your
          AEGIS client account.
        </p>
        <Link
          href="/login?next=/profile"
          className="mt-6 inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-sm font-light tracking-wide text-[#D1A866] transition-all hover:border-[#D1A866]/60 hover:bg-[#D1A866]/15"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (mode === "error" || !user || !client) {
    return (
      <div className="rounded-sm border border-red-400/20 bg-[#10283A]/50 p-8 text-center sm:p-12">
        <p className="text-sm text-red-300">
          {loadError ?? "Unable to load profile."}
        </p>
      </div>
    );
  }

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
    </div>
  );
}
