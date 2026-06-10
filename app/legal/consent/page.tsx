import type { Metadata } from "next";

import AdvisorAccessConsent from "@/components/aegis/legal/AdvisorAccessConsent";
import DocumentUploadConsent from "@/components/aegis/legal/DocumentUploadConsent";
import LegalNoticeCard from "@/components/aegis/legal/LegalNoticeCard";
import LegalPageShell from "@/components/aegis/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Client Consent Overview",
  description:
    "Draft client consent overview for AEGIS data processing, document uploads, and advisor access.",
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

export default function ConsentPage() {
  return (
    <LegalPageShell
      title="Client Consent Overview"
      subtitle="Summary of how client data, documents, and advisor access work in the AEGIS platform during beta."
    >
      <LegalNoticeCard title="MVP consent layer" variant="info">
        <p>
          This overview describes in-product consent concepts for demo and
          private beta. It is not a substitute for formal consent records,
          e-signatures, or regulatory compliance documentation. Database-backed
          consent tracking is not yet implemented.
        </p>
      </LegalNoticeCard>

      <Section title="1. Platform purpose">
        <p>
          By using AEGIS, you acknowledge the platform processes financial
          profile information to deliver planning-support diagnostics and
          advisor-reviewed reports. You understand outputs are not standalone
          advice.
        </p>
      </Section>

      <Section title="2. Data you provide">
        <p>
          You may enter profile data, save module results, upload documents, and
          generate reports. This information may include sensitive personal and
          financial details. Provide only what is relevant to your planning
          relationship.
        </p>
      </Section>

      <Section title="3. Document upload consent">
        <DocumentUploadConsent />
      </Section>

      <Section title="4. Advisor and admin access">
        <AdvisorAccessConsent />
      </Section>

      <Section title="5. In-product notices">
        <p>
          The platform displays trust notices, upload reminders, report
          disclaimers, and a dismissible legal banner. Acknowledging the banner
          is stored locally on your device and does not create a formal consent
          record.
        </p>
      </Section>

      <Section title="6. Your choices">
        <ul className="list-inside list-disc space-y-2 pl-1">
          <li>Review the Terms, Privacy Policy, and Disclaimer at any time</li>
          <li>Discuss data handling with your assigned advisor</li>
          <li>
            Avoid uploading unnecessary sensitive documents to the vault
          </li>
          <li>
            Contact your platform administrator for access or assignment
            questions
          </li>
        </ul>
      </Section>

      <Section title="7. Before commercial use">
        <p>
          Formal consent workflows, retention policies, and jurisdiction-specific
          requirements must be defined with qualified legal counsel before real
          client onboarding at scale.
        </p>
      </Section>
    </LegalPageShell>
  );
}
