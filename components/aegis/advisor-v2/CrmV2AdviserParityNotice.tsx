/**
 * Subtle adviser-only note for Phase 14 workspace replacement.
 * Rendered inside AdviserCrmV2Shell only — never on client portal routes.
 */
export default function CrmV2AdviserParityNotice() {
  return (
    <p
      className="mb-6 max-w-3xl rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-4 py-3 text-xs font-light leading-relaxed text-[#F3F1EA]/45"
      role="note"
    >
      CRM V2 is now your primary adviser workspace. Classic tools remain
      available under <span className="text-[#F3F1EA]/60">More</span>.
    </p>
  );
}
