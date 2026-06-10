import { NextResponse } from "next/server";

import type { DiscoverStoredProfile } from "@/lib/aegis/localProfile";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type CurrentDiscoverResponse =
  | {
      ok: true;
      profile: DiscoverStoredProfile;
      discoverProfileId: string;
      clientId: string;
    }
  | { ok: false; error?: string; profile?: null };

export async function GET(): Promise<NextResponse<CurrentDiscoverResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required", profile: null },
        { status: 401 },
      );
    }

    const current = await loadCurrentDiscoverProfile(session.client.id);

    if (!current) {
      return NextResponse.json({ ok: false, profile: null });
    }

    const { id, clientId, ...profile } = current;

    return NextResponse.json({
      ok: true,
      profile,
      discoverProfileId: id,
      clientId,
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load discover profile",
    );

    console.error("[api/discover/current]", err);

    return NextResponse.json(
      { ok: false, error: message, profile: null },
      { status: 500 },
    );
  }
}
