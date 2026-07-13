import Link from "next/link";

import { isCrmV2PilotAvailable } from "@/lib/crm-v2/pilotAvailability";

/**
 * Controlled entry from legacy /advisor into the CRM V2 pilot shell.
 * Rendered only when assertCrmV2Access() would allow /advisor-v2.
 */
export default async function CrmV2PilotEntryBanner() {
  const available = await isCrmV2PilotAvailable();
  if (!available) {
    return null;
  }

  return (
    <section
      aria-label="CRM V2 pilot entry"
      className="mb-6 rounded-sm border border-[#D1A866]/22 bg-[#10283A]/55"
    >
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/75">
            Limited pilot
          </p>
          <p className="text-sm font-light text-[#F3F1EA]/70">
            New adviser workspace for relationships, appointments, service, and
            operations.
          </p>
        </div>
        <Link
          href="/advisor-v2"
          className="inline-flex shrink-0 items-center justify-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/12 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#D1A866] transition-colors hover:border-[#D1A866]/50 hover:bg-[#D1A866]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
        >
          Open CRM V2 Pilot
        </Link>
      </div>
    </section>
  );
}
