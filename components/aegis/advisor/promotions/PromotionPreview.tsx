"use client";

import PromotionCard from "@/components/aegis/promotions/PromotionCard";
import type { PromotionRecord } from "@/lib/aegis/promotions";

type PromotionPreviewProps = {
  promotion: PromotionRecord;
};

export default function PromotionPreview({ promotion }: PromotionPreviewProps) {
  return (
    <section aria-label="Promotion preview" className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
        Client preview
      </p>
      <PromotionCard promotion={promotion} preview />
    </section>
  );
}
