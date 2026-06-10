"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import DocumentCategoryFilter, {
  type DocumentCategoryFilterValue,
} from "@/components/aegis/documents/DocumentCategoryFilter";
import DocumentEmptyState from "@/components/aegis/documents/DocumentEmptyState";
import DocumentList, {
  type VaultDocumentItem,
} from "@/components/aegis/documents/DocumentList";
import DocumentUploadCard, {
  type UploadState,
} from "@/components/aegis/documents/DocumentUploadCard";
import { DOCUMENT_CATEGORY_GUIDANCE } from "@/lib/aegis/clientJourney";
import type { DocumentsListResponse } from "@/app/api/documents/list/route";
import type { DocumentsDeleteResponse } from "@/app/api/documents/delete/route";
import type { DocumentsSignedUrlResponse } from "@/app/api/documents/signed-url/route";
import type { DocumentsUploadResponse } from "@/app/api/documents/upload/route";

type VaultMode = "loading" | "ready" | "auth_required" | "error";

export default function DocumentVaultClient() {
  const [mode, setMode] = useState<VaultMode>("loading");
  const [documents, setDocuments] = useState<VaultDocumentItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] =
    useState<DocumentCategoryFilterValue>("all");
  const [selectedCategory, setSelectedCategory] = useState("insurance");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDocuments = useCallback(async (category?: string) => {
    const query =
      category && category !== "all"
        ? `?category=${encodeURIComponent(category)}`
        : "";

    const response = await fetch(`/api/documents/list${query}`, {
      cache: "no-store",
    });

    if (response.status === 401) {
      return { status: "auth_required" as const };
    }

    const data = (await response.json()) as DocumentsListResponse;

    if (!data.ok) {
      throw new Error(data.error);
    }

    return { status: "ready" as const, documents: data.documents };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const result = await loadDocuments();

        if (cancelled) return;

        if (result.status === "auth_required") {
          setMode("auth_required");
          setDocuments([]);
          return;
        }

        setDocuments(result.documents);
        setMode("ready");
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setMode("error");
        setLoadError(
          err instanceof Error ? err.message : "Failed to load documents",
        );
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadDocuments]);

  useEffect(() => {
    if (mode !== "ready") return;

    let cancelled = false;

    async function refreshFiltered() {
      try {
        const result = await loadDocuments(
          categoryFilter === "all" ? undefined : categoryFilter,
        );

        if (cancelled || result.status !== "ready") return;

        setDocuments(result.documents);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to refresh documents",
        );
      }
    }

    void refreshFiltered();

    return () => {
      cancelled = true;
    };
  }, [categoryFilter, loadDocuments, mode]);

  const visibleDocuments = useMemo(() => {
    if (categoryFilter === "all") return documents;
    return documents.filter((document) => document.category === categoryFilter);
  }, [categoryFilter, documents]);

  const handleUpload = useCallback(
    async (file: File, category: string) => {
      setUploadState("uploading");
      setUploadError(null);
      setActionError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      try {
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as DocumentsUploadResponse;

        if (!data.ok) {
          throw new Error(data.error);
        }

        setDocuments((current) => [data.document, ...current]);
        setUploadState("success");
        window.setTimeout(() => setUploadState("idle"), 2500);
      } catch (err) {
        setUploadState("error");
        setUploadError(
          err instanceof Error ? err.message : "Failed to upload document",
        );
      }
    },
    [],
  );

  const handleOpen = useCallback(async (documentId: string) => {
    setOpeningId(documentId);
    setActionError(null);

    try {
      const response = await fetch("/api/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
      });

      const data = (await response.json()) as DocumentsSignedUrlResponse;

      if (!data.ok) {
        throw new Error(data.error);
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to open document",
      );
    } finally {
      setOpeningId(null);
    }
  }, []);

  const handleDelete = useCallback(async (documentId: string) => {
    const previous = documents;
    setDeletingId(documentId);
    setActionError(null);
    setDocuments((current) =>
      current.filter((document) => document.id !== documentId),
    );

    try {
      const response = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
      });

      const data = (await response.json()) as DocumentsDeleteResponse;

      if (!data.ok) {
        throw new Error(data.error);
      }
    } catch (err) {
      setDocuments(previous);
      setActionError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setDeletingId(null);
    }
  }, [documents]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-16 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading your Document Vault…
        </p>
      </div>
    );
  }

  if (mode === "auth_required") {
    return (
      <div className="rounded-sm border border-[#D1A866]/20 bg-[#10283A]/50 p-8 text-center sm:p-12">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Sign in required
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA]">
          Sign in to access your Document Vault
        </h2>
        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          Secure uploads and downloads are available once you sign in to your
          AEGIS client account.
        </p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-400/20 bg-[#10283A]/50 p-8 text-center sm:p-12">
        <p className="text-sm text-red-300">
          {loadError ?? "Unable to load Document Vault."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ClientPortalHeader
        eyebrow="Document Vault"
        title="Your secure document library"
        subtitle="Store policies, statements, and estate records in one place. Only you and advisors you authorise can access these files."
      />

      <DocumentUploadCard
        uploadState={uploadState}
        uploadError={uploadError}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onUpload={handleUpload}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
              Your library
            </p>
            <h2 className="mt-2 text-xl font-light tracking-wide text-[#F3F1EA]">
              Uploaded documents
            </h2>
            <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
              Filter by category · Open files in a secure new tab
            </p>
          </div>

          <DocumentCategoryFilter
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>

        {categoryFilter !== "all" && DOCUMENT_CATEGORY_GUIDANCE[categoryFilter] && (
          <p className="text-xs font-light text-[#F3F1EA]/40">
            {DOCUMENT_CATEGORY_GUIDANCE[categoryFilter].description}
          </p>
        )}

        {actionError && (
          <p className="text-sm text-red-300">{actionError}</p>
        )}

        {loadError && (
          <p className="text-sm text-red-300">{loadError}</p>
        )}

        {visibleDocuments.length === 0 ? (
          <DocumentEmptyState />
        ) : (
          <DocumentList
            documents={visibleDocuments}
            openingId={openingId}
            deletingId={deletingId}
            onOpen={handleOpen}
            onDelete={handleDelete}
          />
        )}
      </section>

      <ClientTrustNotice variant="full" context="documents" />
    </div>
  );
}
