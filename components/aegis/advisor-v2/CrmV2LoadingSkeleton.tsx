export default function CrmV2LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading CRM V2">
      <div className="h-8 w-48 rounded-sm bg-[#D1A866]/10" />
      <div className="h-4 w-full max-w-xl rounded-sm bg-[#F3F1EA]/8" />
      <div className="h-32 rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    </div>
  );
}
