"use client";

type RatingSelectorProps = {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  required?: boolean;
};

const RATINGS = [1, 2, 3, 4, 5] as const;

export default function RatingSelector({
  label,
  value,
  onChange,
  required = false,
}: RatingSelectorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
        {label}
        {required ? " *" : ""}
      </legend>
      <div className="flex flex-wrap gap-2">
        {RATINGS.map((rating) => {
          const selected = value === rating;
          return (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className={`min-w-10 rounded-sm border px-3 py-2 text-sm font-light transition-colors ${
                selected
                  ? "border-[#D1A866]/50 bg-[#D1A866]/15 text-[#D1A866]"
                  : "border-[#D1A866]/15 bg-[#071B2A]/60 text-[#F3F1EA]/55 hover:border-[#D1A866]/30"
              }`}
              aria-pressed={selected}
            >
              {rating}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
