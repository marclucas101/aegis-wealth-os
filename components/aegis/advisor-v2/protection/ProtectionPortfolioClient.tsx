"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  AdviserProtectionExtractionDetailDto,
  AdviserProtectionPortfolioDto,
  CrmProtectionWorkspaceView,
} from "@/lib/crm-v2/protection/types";

const VIEWS: Array<{ id: CrmProtectionWorkspaceView; label: string }> = [
  { id: "summary", label: "Portfolio Summary" },
  { id: "policies", label: "Policies" },
  { id: "coverage", label: "Coverage" },
  { id: "awaiting_verification", label: "Awaiting Verification" },
  { id: "missing_documents", label: "Missing Documents" },
  { id: "version_history", label: "Version History" },
  { id: "review_activity", label: "Review Activity" },
];

type Props = {
  relationshipId: string;
  initialView: CrmProtectionWorkspaceView;
  initialPortfolio: AdviserProtectionPortfolioDto | null;
  initialExtraction: AdviserProtectionExtractionDetailDto | null;
  loadError: string | null;
};

export function ProtectionPortfolioClient({
  relationshipId,
  initialView,
  initialPortfolio,
  initialExtraction,
  loadError,
}: Props) {
  const [view, setView] = useState<CrmProtectionWorkspaceView>(initialView);
  const [portfolio, setPortfolio] = useState<AdviserProtectionPortfolioDto | null>(initialPortfolio);
  const [extraction, setExtraction] = useState<AdviserProtectionExtractionDetailDto | null>(
    initialExtraction,
  );
  const [error, setError] = useState<string | null>(loadError);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function refreshPortfolio() {
    setError(null);
    try {
      const res = await fetch(`/api/advisor-v2/relationships/${relationshipId}/protection`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.reason === "feature_disabled" ? "Protection portfolio is not enabled." : "Unable to load portfolio.");
        return;
      }
      setPortfolio(data.portfolio);
    } catch {
      setError("Unable to load portfolio.");
    }
  }

  async function handleConfirm() {
    if (!extraction) return;
    setActionMessage(null);
    const res = await fetch(`/api/advisor-v2/protection/extractions/${extraction.extractionId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: extraction.version }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage(res.status === 409 ? "Review is stale — reload and try again." : "Confirmation failed.");
      return;
    }
    setActionMessage("Policy version confirmed.");
    await refreshPortfolio();
  }

  async function handleReject() {
    if (!extraction) return;
    const res = await fetch(`/api/advisor-v2/protection/extractions/${extraction.extractionId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: extraction.version,
        rejectionReason: "Adviser rejected provisional extraction",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage("Rejection failed.");
      return;
    }
    setActionMessage("Extraction rejected.");
    setExtraction(null);
    await refreshPortfolio();
  }

  const summary = portfolio?.portfolioSummary;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Link href={`/advisor-v2/relationships/${relationshipId}?tab=financial-plan`} className="text-sm text-muted-foreground hover:underline">
          ← Financial Plan
        </Link>
        <h1 className="text-2xl font-semibold">Protection Portfolio</h1>
        {portfolio && <p className="text-sm text-muted-foreground">{portfolio.clientDisplayName}</p>}
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Protection views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              view === item.id ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {actionMessage && <p className="text-sm text-green-700" role="status">{actionMessage}</p>}

      {portfolio && view === "summary" && summary && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Confirmed policies" value={summary.confirmedPolicyCount} />
          <StatCard label="Awaiting verification" value={summary.awaitingVerificationCount} />
          <StatCard label="Missing source documents" value={summary.missingSourceDocumentCount} />
          <StatCard label="Provisional extractions" value={summary.provisionalExtractionCount} />
          <StatCard label="Upcoming expiry/maturity" value={summary.upcomingExpiryCount} />
          <StatCard
            label="Last verified"
            value={summary.lastPortfolioVerifiedAt ? new Date(summary.lastPortfolioVerifiedAt).toLocaleDateString() : "Not verified"}
          />
        </section>
      )}

      {portfolio && (view === "policies" || view === "coverage") && (
        <section className="space-y-3">
          {portfolio.policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No structured policies yet. Run extraction from a protection report.</p>
          ) : (
            portfolio.policies.map((policy) => (
              <article key={policy.policyId} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium">{policy.displayName}</h2>
                    <p className="text-sm text-muted-foreground">{policy.insurer} · {policy.policyCategoryLabel}</p>
                  </div>
                  <StatusBadge label={policy.verificationStateLabel} provisional={policy.verificationState === "provisional"} />
                </div>
                <dl className="grid gap-1 text-sm sm:grid-cols-2">
                  <div><dt className="inline text-muted-foreground">Owner: </dt><dd className="inline">{policy.policyOwner}</dd></div>
                  <div><dt className="inline text-muted-foreground">Life assured: </dt><dd className="inline">{policy.lifeAssured}</dd></div>
                  {view === "coverage" && (
                    <>
                      <div><dt className="inline text-muted-foreground">Sum assured: </dt><dd className="inline">{policy.sumAssured != null ? `${policy.sumAssuredCurrency} ${policy.sumAssured.toLocaleString()}` : "—"}</dd></div>
                      <div><dt className="inline text-muted-foreground">Premium: </dt><dd className="inline">{policy.premium != null ? `${policy.premium} (${policy.premiumFrequency ?? "—"})` : "—"}</dd></div>
                    </>
                  )}
                  <div><dt className="inline text-muted-foreground">Policy ref: </dt><dd className="inline">{policy.policyRefMasked ?? "Masked"}</dd></div>
                  <div><dt className="inline text-muted-foreground">Source: </dt><dd className="inline">{policy.sourceDocumentStatusLabel}</dd></div>
                </dl>
                {policy.isStale && <p className="text-xs text-amber-700">Stale — verification overdue</p>}
              </article>
            ))
          )}
        </section>
      )}

      {portfolio && view === "awaiting_verification" && (
        <section className="space-y-3">
          {portfolio.awaitingVerification.length === 0 ? (
            <p className="text-sm text-muted-foreground">No provisional extractions awaiting review.</p>
          ) : (
            portfolio.awaitingVerification.map((item) => (
              <article key={item.extractionId} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <h2 className="font-medium">{item.displayName ?? "Provisional extraction"}</h2>
                <p className="text-sm text-muted-foreground">{item.insurer ?? "Insurer pending"} · {item.reviewStatusLabel}</p>
                <button
                  type="button"
                  className="mt-2 text-sm text-primary hover:underline"
                  onClick={async () => {
                    const res = await fetch(`/api/advisor-v2/protection/extractions/${item.extractionId}`);
                    const data = await res.json();
                    if (res.ok && data.ok) setExtraction(data.extraction);
                  }}
                >
                  Review extraction
                </button>
              </article>
            ))
          )}
        </section>
      )}

      {portfolio && view === "missing_documents" && (
        <section className="space-y-3">
          {portfolio.missingDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">All policies have source documents on file.</p>
          ) : (
            portfolio.missingDocuments.map((p) => (
              <article key={p.policyId} className="rounded-lg border p-4">
                <h2 className="font-medium">{p.displayName}</h2>
                <p className="text-sm text-muted-foreground">Missing authoritative source document in vault</p>
              </article>
            ))
          )}
        </section>
      )}

      {extraction && (
        <section className="rounded-lg border p-4 space-y-4" aria-labelledby="verification-workspace">
          <h2 id="verification-workspace" className="text-lg font-medium">Verification workspace</h2>
          <p className="text-sm text-amber-800">Provisional — not confirmed until you explicitly confirm.</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Insurer</dt><dd>{extraction.extractedFields.insurer}</dd></div>
            <div><dt className="text-muted-foreground">Plan</dt><dd>{extraction.extractedFields.displayName}</dd></div>
            <div><dt className="text-muted-foreground">Owner</dt><dd>{extraction.extractedFields.policyOwner}</dd></div>
            <div><dt className="text-muted-foreground">Life assured</dt><dd>{extraction.extractedFields.lifeAssured}</dd></div>
            <div><dt className="text-muted-foreground">Masked ref</dt><dd>{extraction.extractedFields.policyRefMasked ?? "—"}</dd></div>
          </dl>
          {extraction.duplicateCandidatePolicyIds.length > 0 && (
            <p className="text-sm text-amber-800">Possible duplicate policies detected — choose match on confirm.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void handleConfirm()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Confirm policy version
            </button>
            <button type="button" onClick={() => void handleReject()} className="rounded-md border px-4 py-2 text-sm">
              Reject extraction
            </button>
            <Link href="/advisor/protection-report" className="rounded-md border px-4 py-2 text-sm hover:underline">
              Open source report tool
            </Link>
          </div>
        </section>
      )}

      {portfolio?.bounded && (
        <p className="text-xs text-muted-foreground">Results truncated — refine filters or contact support.</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ label, provisional }: { label: string; provisional: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${provisional ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}>
      {label}
    </span>
  );
}
