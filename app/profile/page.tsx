import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ProfileClient from "@/components/aegis/profile/ProfileClient";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  await cookies();
  const session = await ensureUserClientProfile();

  if (!session.authenticated) {
    redirect("/login?next=/profile");
  }

  return (
    <AuthenticatedAppShell
      title="Profile"
      subtitle="Account & client record"
    >
      <ProfileClient user={session.user} client={session.client} />
    </AuthenticatedAppShell>
  );
}
