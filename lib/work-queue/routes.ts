const CLIENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_ROUTE_PREFIXES = [
  "/advisor",
  "/advisor/clients/",
  "/advisor/appointments",
  "/advisor/tasks",
  "/advisor-v2/today",
  "/advisor-v2/appointments",
  "/advisor-v2/relationships",
  "/advisor-v2/service",
  "/advisor-v2/communications",
  "/advisor-v2/settings",
  "/advisor-v2/operations",
] as const;

function assertClientId(clientId: string): void {
  if (!CLIENT_ID_RE.test(clientId)) {
    throw new Error("Invalid client id for work-queue route");
  }
}

/** Server-derived allowlisted navigation targets for work items. */
export const workQueueRoutes = {
  advisorDashboard: () => "/advisor",
  advisorTasks: () => "/advisor",
  clientOverview: (clientId: string) => {
    assertClientId(clientId);
    return `/advisor/clients/${clientId}?tab=overview`;
  },
  clientTasks: (clientId: string) => {
    assertClientId(clientId);
    return `/advisor/clients/${clientId}?tab=overview`;
  },
  clientRoadmap: (clientId: string) => {
    assertClientId(clientId);
    return `/advisor/clients/${clientId}/roadmap`;
  },
  clientShieldReview: (clientId: string) => {
    assertClientId(clientId);
    return `/advisor/clients/${clientId}?tab=shield-diagnostic`;
  },
  clientPlanningOutputs: (clientId: string, focus?: string) => {
    assertClientId(clientId);
    const base = `/advisor/clients/${clientId}/planning-outputs`;
    if (!focus) return base;
    return `${base}?focus=${encodeURIComponent(focus)}`;
  },
  clientMeetingStudio: (clientId: string, sessionId?: string) => {
    assertClientId(clientId);
    const base = `/advisor/clients/${clientId}/meeting-studio`;
    if (!sessionId) return `${base}?stage=prepare`;
    return `${base}?sessionId=${encodeURIComponent(sessionId)}&stage=prepare`;
  },
  clientMeetingPacks: (clientId: string) => {
    assertClientId(clientId);
    return `/advisor/clients/${clientId}?tab=meeting-packs`;
  },
  clientDocumentVault: (clientId: string) => {
    assertClientId(clientId);
    return `/advisor/clients/${clientId}?tab=document-vault`;
  },
  clientDiscover: (clientId: string) => {
    assertClientId(clientId);
    return `/advisor/clients/${clientId}?tab=overview`;
  },
  adviserAppointments: () => "/advisor/appointments",
} as const;

export function isAllowlistedWorkQueueHref(href: string): boolean {
  if (!href.startsWith("/")) return false;
  return ALLOWED_ROUTE_PREFIXES.some((prefix) => href === prefix || href.startsWith(prefix));
}

export function buildDeterministicWorkItemId(
  sourceType: string,
  sourceId: string,
  ruleKey?: string,
): string {
  if (ruleKey) {
    return `${sourceType}:virtual:${ruleKey}`;
  }
  return `${sourceType}:${sourceId}`;
}
