"use client";

import ClientEmptyState from "@/components/aegis/client/ClientEmptyState";

export default function DocumentEmptyState() {
  return (
    <ClientEmptyState
      eyebrow="Document Vault"
      title="No documents yet"
      description="Upload policies, statements, and estate records so your advisor has a complete picture. Files stay in your private vault."
      primaryHref="#upload"
      primaryLabel="Upload above"
      steps={[
        "Choose a category that matches your file",
        "Drag and drop or select a file (up to 10MB)",
        "Open or manage files from your library below",
      ]}
    />
  );
}
