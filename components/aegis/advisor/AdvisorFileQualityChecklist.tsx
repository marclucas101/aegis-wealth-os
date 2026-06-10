"use client";

interface AdvisorFileQualityChecklistProps {
  completedItems: string[];
  missingItems: string[];
}

export default function AdvisorFileQualityChecklist({
  completedItems,
  missingItems,
}: AdvisorFileQualityChecklistProps) {
  const total = completedItems.length + missingItems.length;

  if (total === 0) {
    return (
      <p className="text-sm font-light text-[#F3F1EA]/45">
        No checklist data available.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-emerald-400/80">
          Completed ({completedItems.length})
        </p>
        <ul className="mt-2 space-y-1.5">
          {completedItems.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm font-light text-[#F3F1EA]/70"
            >
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
              {item}
            </li>
          ))}
          {completedItems.length === 0 ? (
            <li className="text-sm font-light text-[#F3F1EA]/35">None yet</li>
          ) : null}
        </ul>
      </div>

      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-amber-300/80">
          Missing or advisory ({missingItems.length})
        </p>
        <ul className="mt-2 space-y-1.5">
          {missingItems.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm font-light text-[#F3F1EA]/55"
            >
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60" />
              {item}
            </li>
          ))}
          {missingItems.length === 0 ? (
            <li className="text-sm font-light text-[#F3F1EA]/35">
              All checklist items complete
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
