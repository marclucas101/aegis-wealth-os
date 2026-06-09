import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AppShell from "@/components/aegis/AppShell";
import ProfileClient from "@/components/aegis/profile/ProfileClient";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const result = await ensureUserClientProfile();

  if (!result.authenticated) {
    redirect("/login?next=/profile");
  }

  return (
    <AppShell
      title="Profile"
      subtitle="Account & client record"
    >
      <ProfileClient user={result.user} client={result.client} />
    </AppShell>
  );
}
