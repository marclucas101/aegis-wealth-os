"use client";

import { categoryLabel } from "@/components/aegis/documents/DocumentCategoryFilter";

export type VaultDocumentItem = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  uploaded_by: string | null;
  created_at: string;
};

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "—";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedDate(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface DocumentListProps {
  documents: VaultDocumentItem[];
  openingId: string | null;
  deletingId: string | null;
  onOpen: (documentId: string) => void;
  onDelete: (documentId: string) => void;
}

export default function DocumentList({
  documents,
  openingId,
  deletingId,
  onOpen,
  onDelete,
}: DocumentListProps) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50">
      <div className="hidden border-b border-[#D1A866]/8 px-5 py-3 sm:grid sm:grid-cols-[minmax(0,1.6fr)_0.8fr_0.7fr_1fr_0.7fr] sm:gap-4">
        {["File", "Category", "Size", "Uploaded", "Actions"].map((heading) => (
          <span
            key={heading}
            className="text-[9px] uppercase tracking-[0.18em] text-[#F3F1EA]/35"
          >
            {heading}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-[#D1A866]/8">
        {documents.map((document) => {
          const isOpening = openingId === document.id;
          const isDeleting = deletingId === document.id;

          return (
            <li
              key={document.id}
              className="px-5 py-4 transition-colors hover:bg-[#1A2A2B]/30"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_0.8fr_0.7fr_1fr_0.7fr] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-light text-[#F3F1EA]">
                    {document.file_name}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/30 sm:hidden">
                    {categoryLabel(document.category)}
                  </p>
                </div>

                <span className="hidden text-xs text-[#F3F1EA]/60 sm:block">
                  {categoryLabel(document.category)}
                </span>

                <span className="text-xs text-[#F3F1EA]/55">
                  {formatFileSize(document.file_size)}
                </span>

                <span className="text-xs text-[#F3F1EA]/45">
                  {formatUploadedDate(document.created_at)}
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(document.id)}
                    disabled={isOpening || isDeleting}
                    className="rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isOpening ? "Opening…" : "Open"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(document.id)}
                    disabled={isOpening || isDeleting}
                    className="rounded-sm border border-[#F3F1EA]/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/55 transition-colors hover:border-red-400/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
