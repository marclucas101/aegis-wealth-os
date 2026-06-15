import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorCalendarRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const target = new URLSearchParams({ section: "calendar" });

  const connected = params.connected;
  if (typeof connected === "string" && connected) {
    target.set("connected", connected);
  }

  const error = params.error;
  if (typeof error === "string" && error) {
    target.set("error", error);
  }

  redirect(`/advisor/my-profile?${target.toString()}`);
}
