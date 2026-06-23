import "server-only";

import { createHash } from "node:crypto";

import { BINDER_PUBLICATION_SCHEMA_VERSION } from "./binderPublicationTypes";

export function buildBinderPublicationIdempotencyKey(input: {
  binderExportId: string;
  binderLineageId: string;
  version: number;
  clientId: string;
  action: "publish" | "withdraw";
}): string {
  const canonical = {
    binder_export_id: input.binderExportId,
    binder_lineage_id: input.binderLineageId,
    version: input.version,
    client_id: input.clientId,
    action: input.action,
    publication_schema_version: BINDER_PUBLICATION_SCHEMA_VERSION,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
