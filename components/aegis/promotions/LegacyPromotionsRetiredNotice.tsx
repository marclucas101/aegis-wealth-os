import { LEGACY_PROMOTIONS_RETIRED_USER_MESSAGE } from "@/lib/promotions/legacyPromotionsRetirementConstants";

type LegacyPromotionsRetiredNoticeProps = {
  audience: "advisor" | "client";
};

export default function LegacyPromotionsRetiredNotice({
  audience,
}: LegacyPromotionsRetiredNoticeProps) {
  const replacementLabel =
    audience === "advisor" ? "Governed Communications (Insights Authoring)" : "Insights & Updates";

  return (
    <div
      role="status"
      className="mb-6 rounded-sm border border-[#D1A866]/25 bg-[#D1A866]/8 px-4 py-3 text-sm font-light text-[#F3F1EA]/80"
    >
      <p>{LEGACY_PROMOTIONS_RETIRED_USER_MESSAGE}</p>
      <p className="mt-2 text-xs text-[#F3F1EA]/50">
        Continue in {replacementLabel}.
      </p>
    </div>
  );
}
