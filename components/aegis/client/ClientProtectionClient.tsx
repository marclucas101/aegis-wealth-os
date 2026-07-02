"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  ClientProtectionPolicyDetailDto,
  ClientProtectionPortfolioDto,
} from "@/lib/crm-v2/protection/types";
import { CRM_PROTECTION_CORRECTION_CATEGORIES } from "@/lib/crm-v2/protection/types";

type Props = {
  initialPortfolio: ClientProtectionPortfolioDto | null;
  initialDetail: ClientProtectionPolicyDetailDto | null;
  policyId?: string;
  showCorrection?: boolean;
  loadError: string | null;
};

export function ClientProtectionClient({
  initialPortfolio,
  initialDetail,
  policyId,
  showCorrection,
  loadError,
}: Props) {
  const [portfolio] = useState<ClientProtectionPortfolioDto | null>(initialPortfolio);
  const [detail] = useState<ClientProtectionPolicyDetailDto | null>(initialDetail);
  const [correctionCategory, setCorrectionCategory] = useState<string>("coverage_amount");
  const [correctionExplanation, setCorrectionExplanation] = useState("");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  async function submitCorrection() {
    if (!policyId || !correctionExplanation.trim()) return;
    setSubmitMessage(null);
    const res = await fetch(`/api/protection/${policyId}/correction-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: correctionCategory,
        explanation: correctionExplanation.trim(),
        idempotencyKey: `correction_${policyId}_${correctionCategory}`,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setSubmitMessage("Unable to submit correction request.");
      return;
    }
    setSubmitMessage("Correction request submitted for adviser review.");
    setCorrectionExplanation("");
  }

  async function submitReviewRequest() {
    setSubmitMessage(null);
    const res = await fetch("/api/protection/review-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "protection_review_request" }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setSubmitMessage("Unable to submit review request.");
      return;
    }
    setSubmitMessage("Protection review request submitted.");
  }

  if (loadError) return <p className="p-6 text-sm text-destructive" role="alert">{loadError}</p>;

  if (detail && policyId) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
        <Link href="/protection" className="text-sm text-muted-foreground hover:underline">← Protection summary</Link>
        <header>
          <h1 className="text-2xl font-semibold">{detail.displayName}</h1>
          <p className="text-sm text-muted-foreground">{detail.insurer} · {detail.policyCategoryLabel}</p>
        </header>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Owner</dt><dd>{detail.policyOwner}</dd></div>
          <div><dt className="text-muted-foreground">Life assured</dt><dd>{detail.lifeAssured}</dd></div>
          <div><dt className="text-muted-foreground">Status</dt><dd>{detail.policyStatusLabel}</dd></div>
          <div><dt className="text-muted-foreground">Last verified</dt><dd>{detail.lastVerifiedAt ? new Date(detail.lastVerifiedAt).toLocaleDateString() : "—"}</dd></div>
        </dl>
        <section>
          <h2 className="font-medium mb-2">Confirmed coverage</h2>
          <ul className="space-y-2 text-sm">
            {detail.coverageComponents.map((c, i) => (
              <li key={`${c.categoryLabel}-${i}`} className="rounded border p-3">
                {c.categoryLabel} — {c.amountLabel}
                {c.durationLabel && <span className="text-muted-foreground"> · {c.durationLabel}</span>}
              </li>
            ))}
          </ul>
        </section>
        {(showCorrection || correctionExplanation) && (
          <section className="rounded-lg border p-4 space-y-3">
            <h2 className="font-medium">Request correction</h2>
            <p className="text-xs text-muted-foreground">Your adviser will review — confirmed policy data is not changed directly.</p>
            <label className="block text-sm">
              Category
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={correctionCategory}
                onChange={(e) => setCorrectionCategory(e.target.value)}
              >
                {CRM_PROTECTION_CORRECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Explanation
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5"
                rows={4}
                maxLength={2000}
                value={correctionExplanation}
                onChange={(e) => setCorrectionExplanation(e.target.value)}
              />
            </label>
            <button type="button" onClick={() => void submitCorrection()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Submit correction request
            </button>
          </section>
        )}
        {submitMessage && <p className="text-sm text-green-700" role="status">{submitMessage}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Protection summary</h1>
        <p className="text-sm text-muted-foreground">Confirmed policy information verified by your adviser.</p>
        {portfolio?.lastPortfolioVerifiedAt && (
          <p className="text-xs text-muted-foreground">
            Portfolio last verified {new Date(portfolio.lastPortfolioVerifiedAt).toLocaleDateString()}
          </p>
        )}
      </header>

      <button type="button" onClick={() => void submitReviewRequest()} className="rounded-md border px-4 py-2 text-sm">
        Request protection review
      </button>

      {portfolio?.policies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No confirmed policies on file yet.</p>
      ) : (
        <ul className="space-y-3">
          {portfolio?.policies.map((policy) => (
            <li key={policy.policyId}>
              <Link href={policy.detailHref} className="block rounded-lg border p-4 hover:bg-muted/50">
                <h2 className="font-medium">{policy.displayName}</h2>
                <p className="text-sm text-muted-foreground">{policy.insurer} · {policy.coverageSummary}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {policy.policyStatusLabel}
                  {policy.lastVerifiedAt && ` · Verified ${new Date(policy.lastVerifiedAt).toLocaleDateString()}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {submitMessage && <p className="text-sm text-green-700" role="status">{submitMessage}</p>}
    </div>
  );
}
