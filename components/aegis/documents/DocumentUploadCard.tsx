"use client";

import { useRef, useState } from "react";

import DocumentUploadConsent from "@/components/aegis/legal/DocumentUploadConsent";
import { DOCUMENT_CATEGORY_OPTIONS } from "@/components/aegis/documents/DocumentCategoryFilter";
import { DOCUMENT_CATEGORY_GUIDANCE } from "@/lib/aegis/clientJourney";

export type UploadState = "idle" | "uploading" | "success" | "error";

const ACCEPTED_FILE_TYPES =
  ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx";

interface DocumentUploadCardProps {
  uploadState: UploadState;
  uploadError: string | null;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onUpload: (file: File, category: string) => Promise<void>;
}

export default function DocumentUploadCard({
  uploadState,
  uploadError,
  selectedCategory,
  onCategoryChange,
  onUpload,
}: DocumentUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const categoryHelp =
    DOCUMENT_CATEGORY_GUIDANCE[selectedCategory]?.description ??
    "Choose the category that best matches this file.";

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await onUpload(file, selectedCategory);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <section
      id="upload"
      className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 scroll-mt-6"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="relative p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
              Upload documents
            </p>
            <h2 className="mt-2 text-xl font-light tracking-wide text-[#F3F1EA] sm:text-2xl">
              Add files to your vault
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
              PDF, images, Word, and Excel up to 10MB. Pick a category first so
              your advisor can find files quickly.
            </p>
          </div>

          <label className="flex min-w-[12rem] flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Category
            </span>
            <select
              value={selectedCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
              disabled={uploadState === "uploading"}
              className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/70 px-3 py-2 text-sm text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/45"
            >
              {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mb-4 rounded-sm border border-[#F3F1EA]/8 bg-[#071B2A]/40 px-3 py-2 text-xs font-light text-[#F3F1EA]/45">
          <span className="text-[#F3F1EA]/60">
            {DOCUMENT_CATEGORY_GUIDANCE[selectedCategory]?.label ?? "Category"}:{" "}
          </span>
          {categoryHelp}
        </p>

        <DocumentUploadConsent />

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={`rounded-sm border border-dashed px-6 py-10 text-center transition-colors ${
            dragActive
              ? "border-[#D1A866]/50 bg-[#D1A866]/8"
              : "border-[#F3F1EA]/15 bg-[#071B2A]/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
            disabled={uploadState === "uploading"}
          />

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D1A866]/20 bg-[#1A2A2B]/60">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-[#D1A866]/70"
              aria-hidden
            >
              <path
                d="M12 16V8M12 8l-3 3M12 8l3 3"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 20h14"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="text-sm font-light text-[#F3F1EA]/70">
            Drag and drop a file here, or
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadState === "uploading"}
            className="mt-4 inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadState === "uploading" ? "Uploading…" : "Choose File"}
          </button>
        </div>

        {uploadState === "success" && (
          <p className="mt-4 text-sm text-emerald-300/90">
            Document uploaded — it appears in your library below.
          </p>
        )}

        {uploadState === "error" && uploadError && (
          <p className="mt-4 text-sm text-red-300">{uploadError}</p>
        )}
      </div>
    </section>
  );
}
