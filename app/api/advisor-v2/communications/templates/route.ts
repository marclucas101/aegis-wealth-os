import { NextResponse } from "next/server";

import { assertCrmV2CommunicationsAccess } from "@/lib/crm-v2/access";
import { createCrmCommunicationsAdmin } from "@/lib/crm-v2/communications/db";
import { CRM_V2_COMMUNICATIONS_MAX_ITEMS } from "@/lib/crm-v2/constants";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2CommunicationsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const admin = createCrmCommunicationsAdmin();
    const { data } = await admin
      .from("crm_communication_templates")
      .select("id, template_key, category, channel, title, body, variable_schema, compliance_status, version, active")
      .eq("active", true)
      .eq("compliance_status", "approved")
      .order("category")
      .limit(CRM_V2_COMMUNICATIONS_MAX_ITEMS);

    const templates = (data ?? []).map((row) => ({
      templateId: String((row as { id: string }).id),
      templateKey: String((row as { template_key: string }).template_key),
      category: String((row as { category: string }).category),
      channel: String((row as { channel: string }).channel),
      title: String((row as { title: string }).title),
      bodyPreview:
        String((row as { body: string }).body).length > 120
          ? `${String((row as { body: string }).body).slice(0, 119)}…`
          : String((row as { body: string }).body),
      variableSchema: (row as { variable_schema: string[] }).variable_schema ?? [],
      complianceStatus: String((row as { compliance_status: string }).compliance_status),
      version: Number((row as { version: number }).version),
      active: Boolean((row as { active: boolean }).active),
    }));

    return NextResponse.json(
      { ok: true, templates },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load templates") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
