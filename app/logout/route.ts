import { type NextRequest } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectHome(request: NextRequest, headers = new Headers()): Response {
  headers.set("Location", new URL("/", request.url).toString());
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return new Response(null, { status: 303, headers });
}

/**
 * Sign-out MUST be a POST. Next.js <Link> prefetches GET URLs in production,
 * so a GET logout gets triggered by the header's Sign out link merely being
 * visible — silently clearing the session cookie after every page load.
 */
export async function POST(request: NextRequest) {
  const responseHeaders = new Headers();
  const supabase = createRouteHandlerSupabaseClient(request, responseHeaders);
  await supabase.auth.signOut();

  return redirectHome(request, responseHeaders);
}

/** Safe no-op for direct visits, prefetches, and crawlers — never signs out. */
export async function GET(request: NextRequest) {
  return redirectHome(request);
}
