import type { Metadata } from "next";

import LegalNoticeCard from "@/components/aegis/legal/LegalNoticeCard";
import LegalPageShell from "@/components/aegis/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Draft terms of use for the AEGIS Wealth Operating System — for demo and private beta only.",
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

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Use"
      subtitle="Conditions for accessing and using the AEGIS Wealth Operating System™ planning-support platform."
    >
      <Section title="1. Acceptance">
        <p>
          By accessing or using AEGIS, you agree to these Terms of Use. If you
          do not agree, do not use the platform. These terms apply to clients,
          advisors, and administrators who access the service.
        </p>
      </Section>

      <Section title="2. Nature of the service">
        <p>
          AEGIS is a planning-support platform. It helps organise financial
          profile information, diagnostic scores, stress scenarios, roadmaps,
          documents, and advisor-reviewed reports. It is not a substitute for
          personalised advice from a qualified professional.
        </p>
        <LegalNoticeCard title="Not advice" variant="warning">
          <p>
            AEGIS outputs are planning-support tools. They are not standalone
            financial, investment, tax, legal, or insurance advice. Consult a
            qualified professional before making financial decisions.
          </p>
        </LegalNoticeCard>
      </Section>

      <Section title="3. Eligibility and accounts">
        <p>
          You must provide accurate registration information and maintain the
          security of your credentials. You are responsible for activity under
          your account. Advisors and admins access client information only
          through role-based permissions assigned by the platform operator.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-inside list-disc space-y-2 pl-1">
          <li>Upload documents you do not have the right to share</li>
          <li>
            Upload unnecessary sensitive data unrelated to financial planning
          </li>
          <li>Attempt to bypass access controls or security measures</li>
          <li>
            Use the platform for unlawful purposes or to misrepresent outputs as
            regulated advice
          </li>
        </ul>
      </Section>

      <Section title="5. Intellectual property">
        <p>
          AEGIS branding, methodology labels, scoring frameworks, and platform
          design remain the property of the platform operator. Client-provided
          data and uploaded documents remain yours, subject to the access
          permissions described in the Privacy Policy and Client Consent
          Overview.
        </p>
      </Section>

      <Section title="6. Availability and changes">
        <p>
          The platform may be updated, modified, or interrupted for maintenance
          without prior notice during beta or demo periods. Features and legal
          terms may change; continued use after updates constitutes acceptance
          of revised terms once published.
        </p>
      </Section>

      <Section title="7. Limitation of liability">
        <p>
          To the fullest extent permitted by applicable law, the platform is
          provided &ldquo;as is&rdquo; for planning-support purposes. The
          operator does not warrant uninterrupted service or accuracy of
          illustrative diagnostics. Neither the operator nor advisors using the
          platform are liable for decisions made solely on the basis of
          unreviewed platform outputs.
        </p>
      </Section>

      <Section title="8. Governing framework">
        <p>
          These draft terms are intended for demo and private beta use. Final
          governing law, jurisdiction, and dispute resolution must be specified
          by qualified legal counsel before commercial deployment.
        </p>
      </Section>
    </LegalPageShell>
  );
}
