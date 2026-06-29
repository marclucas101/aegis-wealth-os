/**
 * Mocked assignment-scope checks for CRM V2 relationship IDOR QA.
 * Does not connect to production or live Supabase.
 */

export type MockClientRow = {
  id: string;
  advisor_user_id: string;
  display_name: string;
};

export function mockResolveAccessibleClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  book: MockClientRow[],
): "not_found" | "forbidden" | "ok" {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(clientId)) return "not_found";

  const client = book.find((row) => row.id === clientId);
  if (!client) return "not_found";
  if (userRole === "advisor" && client.advisor_user_id !== authUserId) {
    return "forbidden";
  }
  return "ok";
}

export function runRelationshipAccessMockTests(): { passed: number; failed: string[] } {
  const adviserA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const adviserB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const clientA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const clientB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const forged = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  const book: MockClientRow[] = [
    { id: clientA, advisor_user_id: adviserA, display_name: "Client A" },
    { id: clientB, advisor_user_id: adviserB, display_name: "Client B" },
  ];

  const cases: Array<{ name: string; pass: boolean }> = [
    {
      name: "adviser A sees assigned client",
      pass: mockResolveAccessibleClient(adviserA, "advisor", clientA, book) === "ok",
    },
    {
      name: "adviser A denied client B",
      pass: mockResolveAccessibleClient(adviserA, "advisor", clientB, book) === "forbidden",
    },
    {
      name: "forged UUID not found",
      pass: mockResolveAccessibleClient(adviserA, "advisor", forged, book) === "not_found",
    },
    {
      name: "invalid UUID not found",
      pass: mockResolveAccessibleClient(adviserA, "advisor", "not-a-uuid", book) === "not_found",
    },
    {
      name: "admin can access any assigned book client",
      pass: mockResolveAccessibleClient(adviserA, "admin", clientB, book) === "ok",
    },
    {
      name: "forbidden does not upgrade to ok",
      pass: mockResolveAccessibleClient(adviserB, "advisor", clientA, book) !== "ok",
    },
  ];

  const failed = cases.filter((c) => !c.pass).map((c) => c.name);
  return { passed: cases.length - failed.length, failed };
}
