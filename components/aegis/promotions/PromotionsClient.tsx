"use client";

import { useEffect, useState } from "react";

import type { AdviserContactResponse } from "@/app/api/adviser-contact/route";
import type { PromotionsListResponse } from "@/app/api/promotions/route";
import PromotionCard from "@/components/aegis/promotions/PromotionCard";
import PromotionsEmptyState from "@/components/aegis/promotions/PromotionsEmptyState";
import type { AdviserContact } from "@/lib/aegis/adviserContact";
import type { ClientSafePromotionRecord } from "@/lib/aegis/promotions";

type LoadState = "loading" | "ready" | "error";

export default function PromotionsClient() {
  const [state, setState] = useState<LoadState>("loading");
  const [promotions, setPromotions] = useState<ClientSafePromotionRecord[]>([]);
  const [adviserContact, setAdviserContact] = useState<AdviserContact | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPromotions() {
      try {
        const [promotionsResponse, contactResponse] = await Promise.all([
          fetch("/api/promotions", { cache: "no-store" }),
          fetch("/api/adviser-contact", { cache: "no-store" }),
        ]);

        const data = (await promotionsResponse.json()) as PromotionsListResponse;
        const contactData =
          (await contactResponse.json()) as AdviserContactResponse;

        if (cancelled) {
          return;
        }

        if (!promotionsResponse.ok || !data.ok) {
          setState("error");
          setError(!data.ok ? data.error : "Failed to load opportunities");
          return;
        }

        if (contactResponse.ok && contactData.ok) {
          setAdviserContact(contactData.contact);
        }

        setPromotions(data.promotions);
        setState("ready");
      } catch {
        if (!cancelled) {
          setState("error");
          setError("Failed to load opportunities");
        }
      }
    }

    void loadPromotions();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="space-y-4">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/40"
          />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-sm border border-red-500/20 bg-red-500/5 p-6 text-sm font-light text-red-200/80">
        {error ?? "Unable to load opportunities."}
      </div>
    );
  }

  if (promotions.length === 0) {
    return <PromotionsEmptyState />;
  }

  return (
    <div className="space-y-5">
      {promotions.map((promotion) => (
        <PromotionCard
          key={promotion.id}
          promotion={promotion}
          adviserContact={adviserContact}
        />
      ))}
    </div>
  );
}
