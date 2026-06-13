import { Suspense } from "react";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import CalendarSetupClient from "@/components/aegis/advisor/calendar/CalendarSetupClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdvisorCalendarPage() {
  return (
    <AuthenticatedAppShell
      title="Calendar Setup"
      subtitle="Connect Google Calendar and configure client booking"
    >
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
        }
      >
        <CalendarSetupClient />
      </Suspense>
    </AuthenticatedAppShell>
  );
}
