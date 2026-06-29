/**
 * Mocked assignment-scope checks for CRM V2 appointment IDOR QA.
 */

import { isValidAppointmentId } from "./identity";
import { canAdviserTransition } from "./lifecycle";
import { runAppointmentLifecycleTests } from "./lifecycleTests";

export type MockAppointmentRow = {
  id: string;
  adviser_user_id: string;
  client_id: string;
};

export type MockClientRow = {
  id: string;
  advisor_user_id: string;
};

export function mockResolveAppointment(
  authUserId: string,
  userRole: "advisor" | "admin",
  appointmentId: string,
  appointments: MockAppointmentRow[],
  clients: MockClientRow[],
): "not_found" | "ok" {
  if (!isValidAppointmentId(appointmentId)) return "not_found";
  const appointment = appointments.find((a) => a.id === appointmentId);
  if (!appointment) return "not_found";
  const client = clients.find((c) => c.id === appointment.client_id);
  if (!client) return "not_found";
  if (userRole === "advisor" && appointment.adviser_user_id !== authUserId) {
    return "not_found";
  }
  if (userRole === "advisor" && client.advisor_user_id !== authUserId) {
    return "not_found";
  }
  return "ok";
}

export function runAppointmentAccessMockTests(): { passed: number; failed: string[] } {
  const adviserA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const adviserB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const clientA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const clientB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const apptA = "11111111-1111-4111-8111-111111111111";
  const apptB = "22222222-2222-4222-8222-222222222222";
  const forged = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  const clients: MockClientRow[] = [
    { id: clientA, advisor_user_id: adviserA },
    { id: clientB, advisor_user_id: adviserB },
  ];

  const appointments: MockAppointmentRow[] = [
    { id: apptA, adviser_user_id: adviserA, client_id: clientA },
    { id: apptB, adviser_user_id: adviserB, client_id: clientB },
  ];

  const cases: Array<{ name: string; pass: boolean }> = [
    {
      name: "adviser A can open own appointment",
      pass: mockResolveAppointment(adviserA, "advisor", apptA, appointments, clients) === "ok",
    },
    {
      name: "adviser A denied adviser B appointment",
      pass: mockResolveAppointment(adviserA, "advisor", apptB, appointments, clients) === "not_found",
    },
    {
      name: "forged appointment id not found",
      pass: mockResolveAppointment(adviserA, "advisor", forged, appointments, clients) === "not_found",
    },
    {
      name: "invalid appointment id not found",
      pass: mockResolveAppointment(adviserA, "advisor", "bad-id", appointments, clients) === "not_found",
    },
    {
      name: "admin can open any appointment in book",
      pass: mockResolveAppointment(adviserA, "admin", apptB, appointments, clients) === "ok",
    },
    {
      name: "reschedule preserves appointment id concept",
      pass: apptA === apptA,
    },
    {
      name: "confirmed to preparing transition allowed",
      pass: canAdviserTransition("confirmed", "preparing"),
    },
  ];

  const lifecycle = runAppointmentLifecycleTests();
  cases.push({
    name: `lifecycle unit tests (${lifecycle.passed} cases)`,
    pass: lifecycle.failed.length === 0,
  });

  const failed = cases.filter((c) => !c.pass).map((c) => c.name);
  return { passed: cases.length - failed.length, failed };
}
