import "server-only";

import { createAdminSupabaseClient } from "./admin";
import { SIGNED_URL_EXPIRY_SECONDS } from "./documentPersistence";

export const BINDER_EXPORT_BUCKET = "binder-exports";
export const BINDER_MAX_PDF_BYTES = 25 * 1024 * 1024;
export const BINDER_STORAGE_FILENAME = "meeting-pack.pdf";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidBinderStorageUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function buildBinderStoragePath(input: {
  clientId: string;
  binderExportId: string;
  version: number;
}): string {
  if (!isValidBinderStorageUuid(input.clientId)) {
    throw new Error("Invalid client ID for storage path");
  }
  if (!isValidBinderStorageUuid(input.binderExportId)) {
    throw new Error("Invalid binder export ID for storage path");
  }
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new Error("Invalid binder version for storage path");
  }

  return `clients/${input.clientId}/binders/${input.binderExportId}/v${input.version}/${BINDER_STORAGE_FILENAME}`;
}

export async function uploadBinderPdf(input: {
  clientId: string;
  binderExportId: string;
  version: number;
  pdfBuffer: Buffer;
  contentType?: string;
}): Promise<{ path: string; bucket: string }> {
  if (!input.pdfBuffer.length) {
    throw new Error("Empty PDF buffer");
  }
  if (input.pdfBuffer.length > BINDER_MAX_PDF_BYTES) {
    throw new Error("Binder PDF exceeds maximum size");
  }

  const path = buildBinderStoragePath(input);
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.storage
    .from(BINDER_EXPORT_BUCKET)
    .upload(path, input.pdfBuffer, {
      contentType: input.contentType ?? "application/pdf",
      upsert: false,
    });

  if (error || !data?.path) {
    throw new Error(error?.message ?? "Binder upload failed");
  }

  return { path: data.path, bucket: BINDER_EXPORT_BUCKET };
}

export async function createBinderSignedUrl(input: {
  storagePath: string;
  storageBucket?: string;
}): Promise<{ signedUrl: string; expiresIn: number }> {
  const admin = createAdminSupabaseClient();
  const bucket = input.storageBucket ?? BINDER_EXPORT_BUCKET;

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(input.storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed URL");
  }

  return {
    signedUrl: data.signedUrl,
    expiresIn: SIGNED_URL_EXPIRY_SECONDS,
  };
}
