import type { Metadata } from "next";

import LegalNoticeCard from "@/components/aegis/legal/LegalNoticeCard";
import LegalPageShell from "@/components/aegis/legal/LegalPageShell";
import { PLANNING_SUPPORT_DISCLAIMER } from "@/lib/aegis/legal";

export const metadata: Metadata = {
  title: "Financial Planning Disclaimer",
  description:
    "Draft financial planning disclaimer for AEGIS outputs — for demo and private beta only.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-light tracking-wide text-[#F3F1EA]/85">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export default function DisclaimerPage() {
  return (
    <LegalPageShell
      title="Financial Planning Disclaimer"
      subtitle="Important limitations on AEGIS diagnostic outputs, reports, and planning-support features."
    >
      <LegalNoticeCard title="Summary" variant="warning">
        <p>{PLANNING_SUPPORT_DISCLAIMER}</p>
      </LegalNoticeCard>

      <Section title="1. Planning-support, not advice">
        <p>
          The AEGIS Wealth Operating System™ provides structured diagnostics,
          scores, stress scenarios, roadmaps, and printable reports to support
          conversations between clients and qualified professionals. Outputs are
          planning-support tools — not standalone advice of any kind.
        </p>
      </Section>

      <Section title="2. What AEGIS is not">
        <ul className="list-inside list-disc space-y-2 pl-1">
          <li>Not standalone financial advice</li>
          <li>Not investment advice or a recommendation to buy or sell</li>
          <li>Not tax advice or a substitute for a tax professional</li>
          <li>Not legal advice or estate-planning counsel</li>
          <li>
            Not insurance advice unless reviewed and delivered by a qualified
            licensed advisor
          </li>
        </ul>
      </Section>

      <Section title="3. Illustrative diagnostics">
        <p>
          Shield scores, AWRI metrics, stress-test results, roadmap projections,
          and timeline illustrations are based on information you or your
          advisor provide. They are hypothetical diagnostics for discussion —
          not predictions, guarantees, or performance forecasts.
        </p>
      </Section>

      <Section title="4. Advisor-reviewed delivery">
        <p>
          Meaningful financial decisions should follow review with a qualified
          wealth advisor, tax professional, lawyer, or licensed insurance adviser
          as appropriate. AEGIS facilitates organisation and discussion; it
          does not replace professional judgement.
        </p>
      </Section>

      <Section title="5. Reports and exports">
        <p>
          Wealth Blueprint™, Annual Shield Review™, and other printable exports
          include this disclaimer by design. Printed or shared copies remain
          subject to the same limitations. Recipients should not treat exports
          as regulated advice documents.
        </p>
      </Section>

      <Section title="6. No regulatory claims">
        <p>
          AEGIS does not claim regulatory approval, licensing, MAS authorisation,
          or certification. Any reference to institutional-grade methodology
          describes internal diagnostic framing — not a regulatory endorsement.
        </p>
      </Section>

      <Section title="7. Consult a qualified professional">
        <p>
          Before acting on any platform output, consult a qualified professional
          who understands your full circumstances. This draft disclaimer must be
          reviewed by legal counsel before commercial use.
        </p>
      </Section>
    </LegalPageShell>
  );
}
