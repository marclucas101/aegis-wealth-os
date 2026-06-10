import { type NextRequest } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responseHeaders = new Headers();
  const supabase = createRouteHandlerSupabaseClient(request, responseHeaders);
  await supabase.auth.signOut();

  responseHeaders.set("Location", new URL("/", new URL(request.url).origin).toString());
  return new Response(null, { status: 303, headers: responseHeaders });
}
