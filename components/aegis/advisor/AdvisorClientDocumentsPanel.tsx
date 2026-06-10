"use client";

import type { AdvisorDocumentMeta } from "@/lib/supabase/advisorClientQueries";

interface AdvisorClientDocumentsPanelProps {
  documents: AdvisorDocumentMeta[];
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdvisorClientDocumentsPanel({
  documents,
}: AdvisorClientDocumentsPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Documents
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Vault metadata — read-only in this phase
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="relative px-5 py-8 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No documents uploaded for this client.
          </p>
        </div>
      ) : (
        <ul className="relative divide-y divide-[#D1A866]/8">
          {documents.map((doc) => (
            <li key={doc.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-light text-[#F3F1EA]">
                    {doc.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#F3F1EA]/40">
                    {doc.fileName}
                  </p>
                </div>
                <span className="shrink-0 rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/55">
                  {doc.category}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
                <span>{formatFileSize(doc.fileSizeBytes)}</span>
                <span>{doc.mimeType ?? "unknown type"}</span>
                <span>{formatDate(doc.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
