import "server-only";

import { resolveAccessibleClient } from "./advisorClientAccess";
import {
  loadDashboardSnapshot,
  type DashboardSnapshot,
} from "./dashboardQueries";
import {
  loadShieldDiagnosticSnapshot,
  loadStressTestingSnapshot,
  type ShieldDiagnosticSnapshot,
  type StressTestingSnapshot,
} from "./moduleQueries";
import {
  loadStressTestHistory,
  type StressTestHistoryEntry,
} from "./stressPersistence";
import type { AppClientRow } from "./userProfile";

export type AdvisorClientViewAccess =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; client: AppClientRow };

async function resolveAdvisorClientView(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<AdvisorClientViewAccess> {
  const result = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (result.status === "ok") {
    return { status: "ok", client: result.client };
  }

  return { status: result.status };
}

export async function loadAdvisorClientDashboardView(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "no_profile" }
  | { status: "ok"; snapshot: DashboardSnapshot }
> {
  const access = await resolveAdvisorClientView(authUserId, userRole, clientId);
  if (access.status !== "ok") {
    return access;
  }

  const snapshot = await loadDashboardSnapshot(access.client);
  if (!snapshot) {
    return { status: "no_profile" };
  }

  return { status: "ok", snapshot };
}

export async function loadAdvisorClientShieldDiagnosticView(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "no_profile" }
  | { status: "ok"; snapshot: ShieldDiagnosticSnapshot }
> {
  const access = await resolveAdvisorClientView(authUserId, userRole, clientId);
  if (access.status !== "ok") {
    return access;
  }

  const snapshot = await loadShieldDiagnosticSnapshot(access.client);
  if (!snapshot) {
    return { status: "no_profile" };
  }

  return { status: "ok", snapshot };
}

export type AdvisorClientStressTestsView = StressTestingSnapshot & {
  history: StressTestHistoryEntry[];
};

export async function loadAdvisorClientStressTestsView(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "no_profile" }
  | { status: "ok"; snapshot: AdvisorClientStressTestsView }
> {
  const access = await resolveAdvisorClientView(authUserId, userRole, clientId);
  if (access.status !== "ok") {
    return access;
  }

  const snapshot = await loadStressTestingSnapshot(access.client);
  if (!snapshot) {
    return { status: "no_profile" };
  }

  const history = await loadStressTestHistory(access.client);

  return {
    status: "ok",
    snapshot: {
      ...snapshot,
      history,
    },
  };
}
