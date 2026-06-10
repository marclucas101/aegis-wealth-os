import { type NextRequest, NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const redirectResponse = NextResponse.redirect(
    new URL("/", new URL(request.url).origin),
    303,
  );

  const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
  await supabase.auth.signOut();

  return redirectResponse;
}
