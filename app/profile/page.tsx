import type { Metadata } from "next";

import AppShell from "@/components/aegis/AppShell";
import ProfileClient from "@/components/aegis/profile/ProfileClient";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <AppShell
      title="Profile"
      subtitle="Account & client record"
    >
      <ProfileClient />
    </AppShell>
  );
}
