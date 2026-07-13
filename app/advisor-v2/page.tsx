import { redirect } from "next/navigation";

import { CRM_V2_HOME_PATH } from "@/lib/crm-v2/navigation";

/**
 * Legacy `/advisor-v2` home alias — redirects to the primary adviser workspace.
 * Sub-routes under `/advisor-v2/*` remain unchanged for bookmarks and deep links.
 */
export default function AdviserCrmV2AliasPage() {
  redirect(CRM_V2_HOME_PATH);
}
