import Link from "next/link";

export default function DocumentUploadConsent() {
  return (
    <div
      className="mb-4 rounded-sm border border-[#F3F1EA]/10 bg-[#071B2A]/40 px-4 py-3"
      role="note"
      aria-label="Document upload consent"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/75">
        Before you upload
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs font-light leading-relaxed text-[#F3F1EA]/45">
        <li>
          You confirm you have the right to upload each document and that it
          relates to your financial planning profile.
        </li>
        <li>
          Assigned advisors and authorised admins may access uploaded documents
          where your account permissions allow.
        </li>
        <li>
          Avoid uploading irrelevant sensitive data — passwords, full payment
          card numbers, or documents unrelated to planning.
        </li>
      </ul>
      <p className="mt-2 text-[10px] font-light text-[#F3F1EA]/35">
        <Link
          href="/legal/consent"
          className="text-[#D1A866]/60 underline-offset-2 hover:text-[#D1A866] hover:underline"
        >
          Client consent overview
        </Link>
        {" · "}
        <Link
          href="/legal/privacy"
          className="text-[#D1A866]/60 underline-offset-2 hover:text-[#D1A866] hover:underline"
        >
          Privacy policy
        </Link>
      </p>
    </div>
  );
}
