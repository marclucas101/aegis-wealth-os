"use client";

export const DOCUMENT_CATEGORY_OPTIONS = [
  { value: "insurance", label: "Insurance" },
  { value: "investment", label: "Investment" },
  { value: "cpf", label: "CPF" },
  { value: "estate", label: "Estate" },
  { value: "tax", label: "Tax" },
  { value: "property", label: "Property" },
  { value: "loan", label: "Loan" },
  { value: "identity", label: "Identity" },
  { value: "other", label: "Other" },
] as const;

export type DocumentCategoryFilterValue =
  | (typeof DOCUMENT_CATEGORY_OPTIONS)[number]["value"]
  | "all";

interface DocumentCategoryFilterProps {
  value: DocumentCategoryFilterValue;
  onChange: (value: DocumentCategoryFilterValue) => void;
}

export default function DocumentCategoryFilter({
  value,
  onChange,
}: DocumentCategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-sm border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${
          value === "all"
            ? "border-[#D1A866]/45 bg-[#D1A866]/12 text-[#D1A866]"
            : "border-[#F3F1EA]/12 text-[#F3F1EA]/45 hover:border-[#D1A866]/25 hover:text-[#F3F1EA]/70"
        }`}
      >
        All
      </button>

      {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-sm border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${
            value === option.value
              ? "border-[#D1A866]/45 bg-[#D1A866]/12 text-[#D1A866]"
              : "border-[#F3F1EA]/12 text-[#F3F1EA]/45 hover:border-[#D1A866]/25 hover:text-[#F3F1EA]/70"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function categoryLabel(category: string): string {
  const match = DOCUMENT_CATEGORY_OPTIONS.find(
    (option) => option.value === category,
  );
  return match?.label ?? category;
}
