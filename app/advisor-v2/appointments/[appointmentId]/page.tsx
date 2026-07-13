import { redirect } from "next/navigation";

import { CRM_V2_APPOINTMENTS_PATH } from "@/lib/crm-v2/navigation";

export default async function AdviserV2AppointmentDetailAliasPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  redirect(`${CRM_V2_APPOINTMENTS_PATH}/${appointmentId}`);
}
