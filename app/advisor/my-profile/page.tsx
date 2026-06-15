import { Suspense } from "react";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import MyProfileWorkspace from "@/components/aegis/advisor/my-profile/MyProfileWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdvisorMyProfilePage() {
  return (
    <AuthenticatedAppShell
      title="My Profile"
      subtitle="Your adviser profile, calendar connection, and client booking"
    >
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
        }
      >
        <MyProfileWorkspace />
      </Suspense>
    </AuthenticatedAppShell>
  );
}
