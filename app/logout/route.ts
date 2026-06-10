import { type NextRequest, NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
  const redirectResponse = NextResponse.redirect(
    new URL("/", new URL(request.url).origin),
  );

  const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
  await supabase.auth.signOut();

  return redirectResponse;
}
