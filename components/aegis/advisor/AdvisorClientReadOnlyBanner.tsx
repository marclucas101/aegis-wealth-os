export default function AdvisorClientReadOnlyBanner() {
  return (
    <div className="rounded-sm border border-[#D1A866]/20 bg-[#D1A866]/8 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
        Adviser view · Read-only client financial snapshot
      </p>
      <p className="mt-1 text-sm font-light text-[#F3F1EA]/50">
        This mirrors what your client sees in their portal. You are viewing as
        their assigned adviser — not impersonating their account.
      </p>
    </div>
  );
}
