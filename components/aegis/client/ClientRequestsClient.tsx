"use client";

import Link from "next/link";
import { useState } from "react";

import type { ClientServiceRequestDto } from "@/lib/crm-v2/service/types";
import { CRM_SERVICE_REQUEST_CATEGORIES } from "@/lib/crm-v2/service/requestLifecycle";

interface ClientRequestsClientProps {
  initialRequests: ClientServiceRequestDto[];
}

export default function ClientRequestsClient({
  initialRequests,
}: ClientRequestsClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string>("general_enquiry");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, summary, details: details || undefined }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to submit request");
        return;
      }
      setRequests((prev) => [payload.request, ...prev]);
      setSummary("");
      setDetails("");
    } catch {
      setError("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="new-request-heading">
        <h2 id="new-request-heading" className="text-lg font-semibold text-[#F3F1EA]">
          Submit a request
        </h2>
        <p className="mt-1 text-sm text-[#F3F1EA]/70">
          This is not an emergency service. Your assigned adviser will respond through normal servicing channels.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm text-[#F3F1EA]/80">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#F3F1EA]/20 bg-[#1A2332] px-3 py-2 text-[#F3F1EA]"
            >
              {CRM_SERVICE_REQUEST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-[#F3F1EA]/80">
            Summary
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={200}
              required
              className="mt-1 w-full rounded-md border border-[#F3F1EA]/20 bg-[#1A2332] px-3 py-2 text-[#F3F1EA]"
            />
          </label>
          <label className="block text-sm text-[#F3F1EA]/80">
            Details (optional)
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-md border border-[#F3F1EA]/20 bg-[#1A2332] px-3 py-2 text-[#F3F1EA]"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0F1A2A] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>
      </section>

      <section aria-labelledby="requests-heading">
        <h2 id="requests-heading" className="text-lg font-semibold text-[#F3F1EA]">
          Your requests
        </h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-[#F3F1EA]/60">No requests yet.</p>
        ) : (
          <ul className="mt-4 space-y-3" role="list">
            {requests.map((req) => (
              <li
                key={req.requestId}
                className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A2332]/60 p-4"
              >
                <Link href={`/requests/${req.requestId}`} className="block">
                  <p className="text-xs uppercase tracking-wide text-[#C9A227]">
                    {req.categoryLabel}
                  </p>
                  <p className="mt-1 font-medium text-[#F3F1EA]">{req.summary}</p>
                  <p className="mt-1 text-sm text-[#F3F1EA]/60">{req.clientVisibleStatus}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
