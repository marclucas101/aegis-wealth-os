import "server-only";

export const BINDER_PUBLICATION_SCHEMA_VERSION = "phase9f3-pub-v1" as const;

export const BINDER_WITHDRAWAL_REASONS = [
  "client_request",
  "outdated_content",
  "compliance_hold",
  "adviser_withdrawal",
] as const;

export type BinderWithdrawalReason = (typeof BINDER_WITHDRAWAL_REASONS)[number];

export type BinderPublicationStatus = "unpublished" | "published_to_client" | "withdrawn";

export type BinderPublicationResult = {
  binderExportId: string;
  binderLineageId: string;
  version: number;
  publicationStatus: BinderPublicationStatus;
  publishedAt: string | null;
  documentId: string | null;
  reused: boolean;
  supersededBinderId: string | null;
};

export type BinderWithdrawalResult = {
  binderExportId: string;
  binderLineageId: string;
  version: number;
  publicationStatus: BinderPublicationStatus;
  withdrawnAt: string | null;
  reused: boolean;
};

export function isBinderWithdrawalReason(value: string): value is BinderWithdrawalReason {
  return (BINDER_WITHDRAWAL_REASONS as readonly string[]).includes(value);
}
