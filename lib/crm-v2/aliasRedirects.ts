import "server-only";

import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function buildQueryString(searchParams?: SearchParams): string {
  if (!searchParams) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Redirect legacy `/advisor-v2/*` paths to canonical adviser routes (preserves query string). */
export function redirectToCanonicalAdviserRoute(
  canonicalPath: string,
  searchParams?: SearchParams,
): never {
  redirect(`${canonicalPath}${buildQueryString(searchParams)}`);
}
