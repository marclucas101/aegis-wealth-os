import type { ReactNode } from "react";

interface CrmV2SectionPanelProps {
  title: string;
  children: ReactNode;
}

export default function CrmV2SectionPanel({
  title,
  children,
}: CrmV2SectionPanelProps) {
  return (
    <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6 backdrop-blur-sm sm:p-8">
      <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#F3F1EA]/35">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
