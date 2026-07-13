import { redirect } from "next/navigation";

/** CRM V2 landing redirects to Today workspace (Phase 11). */
export default function AdviserCrmV2LandingPage() {
  redirect("/advisor-v2/today");
}
