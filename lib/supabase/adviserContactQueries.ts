import "server-only";

import {
  EMPTY_ADVISER_CONTACT,
  type AdviserContact,
} from "@/lib/aegis/adviserContact";

import { createAdminSupabaseClient } from "./admin";
import { ensureUserClientProfile } from "./userProfile";

type AdviserUserRow = {
  full_name: string | null;
  organisation: string | null;
  phone: string | null;
};

export async function loadAssignedAdviserContact(): Promise<
  | { ok: false; reason: "unauthenticated" }
  | { ok: true; contact: AdviserContact }
> {
  const session = await ensureUserClientProfile();

  if (!session.authenticated) {
    return { ok: false, reason: "unauthenticated" };
  }

  const advisorUserId = session.client.advisor_user_id;
  if (!advisorUserId) {
    return { ok: true, contact: EMPTY_ADVISER_CONTACT };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("users")
    .select("full_name, organisation, phone")
    .eq("id", advisorUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load adviser contact: ${error.message}`);
  }

  const adviser = data as AdviserUserRow | null;
  if (!adviser) {
    return {
      ok: true,
      contact: {
        assigned: true,
        adviserName: null,
        adviserCompany: null,
        adviserPhone: null,
      },
    };
  }

  return {
    ok: true,
    contact: {
      assigned: true,
      adviserName: adviser.full_name?.trim() || null,
      adviserCompany: adviser.organisation?.trim() || null,
      adviserPhone: adviser.phone?.trim() || null,
    },
  };
}
