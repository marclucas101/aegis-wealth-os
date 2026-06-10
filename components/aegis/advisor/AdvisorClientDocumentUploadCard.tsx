"use client";

import { useRef, useState } from "react";

import { DOCUMENT_CATEGORY_OPTIONS } from "@/components/aegis/documents/DocumentCategoryFilter";

export type AdvisorUploadState = "idle" | "uploading" | "success" | "error";

const ACCEPTED_FILE_TYPES =
  ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx";

interface AdvisorClientDocumentUploadCardProps {
  uploadState: AdvisorUploadState;
  uploadError: string | null;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onUpload: (file: File, category: string) => Promise<void>;
}

export default function AdvisorClientDocumentUploadCard({
  uploadState,
  uploadError,
  selectedCategory,
  onCategoryChange,
  onUpload,
}: AdvisorClientDocumentUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await onUpload(file, selectedCategory);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="relative border-b border-[#D1A866]/10 px-5 py-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/75">
            Advisor Upload
          </p>
          <p className="mt-1 text-xs font-light text-[#F3F1EA]/45">
            Upload on behalf of this client. PDF, images, Word, and Excel up to
            10MB.
          </p>
        </div>

        <label className="flex min-w-[11rem] flex-col gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.14em] text-[#F3F1EA]/35">
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
        className={`rounded-sm border border-dashed px-4 py-6 text-center transition-colors ${
          dragActive
            ? "border-[#D1A866]/50 bg-[#D1A866]/8"
            : "border-[#F3F1EA]/12 bg-[#071B2A]/35"
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

        <p className="text-xs font-light text-[#F3F1EA]/55">
          Drag and drop a file, or
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadState === "uploading"}
          className="mt-3 inline-flex rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/18 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploadState === "uploading" ? "Uploading…" : "Choose File"}
        </button>
      </div>

      {uploadState === "success" ? (
        <p className="mt-3 text-xs text-[#D1A866]/85">
          Document uploaded successfully.
        </p>
      ) : null}

      {uploadState === "error" && uploadError ? (
        <p className="mt-3 text-xs text-red-200/80">{uploadError}</p>
      ) : null}
    </div>
  );
}
