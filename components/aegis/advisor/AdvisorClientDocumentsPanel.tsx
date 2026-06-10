"use client";

import { useCallback, useEffect, useState } from "react";

import AdvisorClientDocumentUploadCard, {
  type AdvisorUploadState,
} from "@/components/aegis/advisor/AdvisorClientDocumentUploadCard";
import type { AdvisorDocumentUploadResponse } from "@/app/api/advisor/clients/[clientId]/documents/upload/route";
import type { AdvisorDocumentDeleteResponse } from "@/app/api/advisor/clients/[clientId]/documents/[documentId]/delete/route";
import type { AdvisorDocumentMeta } from "@/lib/supabase/advisorClientQueries";

type UploadedDocumentRecord = Extract<
  AdvisorDocumentUploadResponse,
  { ok: true }
>["document"];

type PanelDocument = AdvisorDocumentMeta & {
  uploadedByAdvisor?: boolean;
};

interface AdvisorClientDocumentsPanelProps {
  clientId: string;
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

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

function mapUploadRecord(record: UploadedDocumentRecord): PanelDocument {
  return {
    id: record.id,
    title: record.file_name,
    category: formatCategoryLabel(record.category),
    fileName: record.file_name,
    mimeType: record.file_type,
    fileSizeBytes: record.file_size,
    createdAt: record.created_at,
    uploadedByAdvisor: Boolean(record.uploaded_by),
  };
}

export default function AdvisorClientDocumentsPanel({
  clientId,
  documents: initialDocuments,
}: AdvisorClientDocumentsPanelProps) {
  const [documents, setDocuments] = useState<PanelDocument[]>(initialDocuments);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState("insurance");
  const [uploadState, setUploadState] = useState<AdvisorUploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const handleUpload = useCallback(
    async (file: File, category: string) => {
      setUploadState("uploading");
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/documents/upload`,
          { method: "POST", body: formData },
        );

        const data = (await response.json()) as AdvisorDocumentUploadResponse;

        if (!response.ok || !data.ok) {
          const message =
            "error" in data && data.error
              ? data.error
              : "Unable to upload document.";
          throw new Error(message);
        }

        setDocuments((current) => [mapUploadRecord(data.document), ...current]);
        setUploadState("success");
      } catch (err) {
        setUploadState("error");
        setUploadError(
          err instanceof Error ? err.message : "Unable to upload document.",
        );
      }
    },
    [clientId],
  );

  async function handleOpen(documentId: string) {
    setOpeningId(documentId);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/documents/${documentId}/signed-url`,
        { method: "POST" },
      );

      const data = (await response.json()) as
        | { ok: true; signedUrl: string }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        const message =
          "error" in data && data.error
            ? data.error
            : "Unable to open document.";
        setErrorById((prev) => ({ ...prev, [documentId]: message }));
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setErrorById((prev) => ({
        ...prev,
        [documentId]: "Unable to open document.",
      }));
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/documents/${documentId}/delete`,
        { method: "POST" },
      );

      const data = (await response.json()) as AdvisorDocumentDeleteResponse;

      if (!response.ok || !data.ok) {
        const message =
          "error" in data && data.error
            ? data.error
            : "Unable to archive document.";
        setErrorById((prev) => ({ ...prev, [documentId]: message }));
        return;
      }

      setDocuments((current) => current.filter((doc) => doc.id !== documentId));
    } catch {
      setErrorById((prev) => ({
        ...prev,
        [documentId]: "Unable to archive document.",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Documents
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Secure vault — view, upload, and archive client records
        </p>
      </div>

      <AdvisorClientDocumentUploadCard
        uploadState={uploadState}
        uploadError={uploadError}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onUpload={handleUpload}
      />

      {documents.length === 0 ? (
        <div className="relative px-5 py-8 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No documents uploaded for this client.
          </p>
        </div>
      ) : (
        <ul className="relative divide-y divide-[#D1A866]/8">
          {documents.map((doc) => {
            const isOpening = openingId === doc.id;
            const isDeleting = deletingId === doc.id;
            const error = errorById[doc.id];

            return (
              <li key={doc.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-light text-[#F3F1EA]">
                      {doc.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#F3F1EA]/40">
                      {doc.fileName}
                    </p>
                    {doc.uploadedByAdvisor ? (
                      <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#D1A866]/60">
                        Uploaded by advisor
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/55">
                      {doc.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpen(doc.id)}
                        disabled={isOpening || isDeleting}
                        className="rounded-sm border border-[#D1A866]/25 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#D1A866] transition hover:border-[#D1A866]/40 hover:bg-[#D1A866]/15 disabled:opacity-45"
                      >
                        {isOpening ? "Opening…" : "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc.id)}
                        disabled={isOpening || isDeleting}
                        className="rounded-sm border border-[#F3F1EA]/12 bg-[#071B2A]/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/45 transition hover:border-red-300/25 hover:bg-red-400/8 hover:text-red-200/75 disabled:opacity-45"
                      >
                        {isDeleting ? "Archiving…" : "Archive"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
                  <span>{formatFileSize(doc.fileSizeBytes)}</span>
                  <span>{doc.mimeType ?? "unknown type"}</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
                {error ? (
                  <p className="mt-2 text-xs font-light text-red-200/75">
                    {error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
