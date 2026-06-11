"use client";

import { useEffect, useState } from "react";

import type { AdviserContactResponse } from "@/app/api/adviser-contact/route";
import CallMyAdviserButton from "@/components/aegis/adviser/CallMyAdviserButton";
import type { AdviserContact } from "@/lib/aegis/adviserContact";

type CallMyAdviserPanelProps = {
  variant?: "card" | "compact";
  className?: string;
  contact?: AdviserContact | null;
};

export default function CallMyAdviserPanel({
  variant = "card",
  className = "",
  contact: contactProp,
}: CallMyAdviserPanelProps) {
  const [fetchedContact, setFetchedContact] = useState<AdviserContact | null>(
    null,
  );
  const [loading, setLoading] = useState(contactProp === undefined);
  const contact = contactProp !== undefined ? contactProp : fetchedContact;

  useEffect(() => {
    if (contactProp !== undefined) {
      return;
    }

    let cancelled = false;

    async function loadContact() {
      try {
        const response = await fetch("/api/adviser-contact", {
          cache: "no-store",
        });
        const data = (await response.json()) as AdviserContactResponse;

        if (cancelled) {
          return;
        }

        if (response.ok && data.ok) {
          setFetchedContact(data.contact);
        } else {
          setFetchedContact(null);
        }
      } catch {
        if (!cancelled) {
          setFetchedContact(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadContact();

    return () => {
      cancelled = true;
    };
  }, [contactProp]);

  if (loading) {
    if (variant === "compact") {
      return null;
    }

    return (
      <div
        className={`h-28 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 ${className}`}
      />
    );
  }

  if (!contact?.assigned) {
    return null;
  }

  return (
    <CallMyAdviserButton
      variant={variant}
      className={className}
      adviserName={contact.adviserName}
      adviserPhone={contact.adviserPhone}
      adviserCompany={contact.adviserCompany}
    />
  );
}
