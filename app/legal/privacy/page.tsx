import type { Metadata } from "next";

import LegalNoticeCard from "@/components/aegis/legal/LegalNoticeCard";
import LegalPageShell from "@/components/aegis/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Draft privacy policy for the AEGIS Wealth Operating System — for demo and private beta only.",
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

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="How the AEGIS platform may process financial profile data, documents, and role-based access."
    >
      <Section title="1. Scope">
        <p>
          This draft privacy policy describes how the AEGIS Wealth Operating
          System™ may collect, store, and process information during demo and
          private beta use. It must be reviewed by qualified legal counsel
          before commercial deployment.
        </p>
      </Section>

      <Section title="2. Information we may process">
        <p>The platform may process:</p>
        <ul className="list-inside list-disc space-y-2 pl-1">
          <li>
            Account identifiers (name, email) and authentication session data
          </li>
          <li>
            Financial profile data entered through Discover and related modules
          </li>
          <li>
            Diagnostic scores, stress scenarios, roadmap items, and saved report
            snapshots
          </li>
          <li>
            Documents uploaded to the document vault, which may contain
            sensitive personal or financial information
          </li>
          <li>
            Advisor notes, tasks, review status, and activity metadata
          </li>
        </ul>
      </Section>

      <Section title="3. How information is used">
        <p>
          Information is used to deliver planning-support features, enable
          advisor-reviewed conversations, generate reports, and maintain
          platform security. Data is not sold. Use for marketing or unrelated
          purposes requires separate consent and legal review.
        </p>
      </Section>

      <Section title="4. Role-based access">
        <LegalNoticeCard title="Who can see your data" variant="info">
          <ul className="list-inside list-disc space-y-2">
            <li>
              <strong className="font-normal text-[#F3F1EA]/65">
                Clients
              </strong>{" "}
              — access their own profile, documents, and outputs
            </li>
            <li>
              <strong className="font-normal text-[#F3F1EA]/65">
                Assigned advisors
              </strong>{" "}
              — may review assigned client profiles, scores, documents, notes,
              tasks, and reports where permitted
            </li>
            <li>
              <strong className="font-normal text-[#F3F1EA]/65">
                Admin users
              </strong>{" "}
              — may manage user roles, client assignments, and platform
              configuration
            </li>
          </ul>
        </LegalNoticeCard>
      </Section>

      <Section title="5. Document uploads">
        <p>
          Uploaded documents may contain sensitive personal or financial data.
          Clients should upload only documents relevant to financial planning
          and avoid unnecessary sensitive information. By uploading, you confirm
          you have the right to share the file and understand that authorised
          advisors and admins may access it where permissions allow.
        </p>
      </Section>

      <Section title="6. Storage and security">
        <p>
          Data is stored using Supabase infrastructure with row-level security
          and role-based API access. No system is perfectly secure; users should
          protect credentials and report suspected unauthorised access promptly.
        </p>
      </Section>

      <Section title="7. Retention and deletion">
        <p>
          Retention periods for beta data must be defined by the platform
          operator and documented before production use. Clients may request
          account-related data handling through their advisor or platform
          administrator once formal data-subject procedures are established.
        </p>
      </Section>

      <Section title="8. Your responsibilities">
        <p>
          Do not upload passwords, full payment card numbers, or documents
          unrelated to planning. Review outputs with a qualified advisor. This
          draft policy does not claim compliance with any specific privacy
          regulation until reviewed by counsel.
        </p>
      </Section>
    </LegalPageShell>
  );
}
