# CRM V2 Phase 12 — Manual Acceptance Checklist

**Branch:** `crm-v2-12-reports-operations`  
**Note:** Do not mark runtime tests as passed unless actually executed.

---

1. Reports feature disabled blocks Reports.
2. Operations feature disabled blocks Operations.
3. Client cannot access Reports.
4. Client cannot access Operations.
5. Adviser sees only assigned relationship data.
6. Cross-adviser source IDs reveal nothing.
7. Reports read performs no writes.
8. Operations read performs no writes.
9. Relationship report shows safe counts.
10. Appointment report links to appointments.
11. Service report links to service workspace.
12. Protection report excludes policy numbers.
13. Moments report excludes ethnicity.
14. Advocacy report excludes advocacy score ranking.
15. Communications report excludes full private message bodies.
16. Today summary is projection-only.
17. Work queue summary is read-only.
18. Feature-control status shows safe flags only.
19. Migration status does not run Supabase CLI.
20. Operations does not expose secrets.
21. Google Calendar panel hides tokens and raw provider errors.
22. Communication failures hide raw provider payloads.
23. Protection extraction errors hide source document content.
24. Partial-source failure renders safely.
25. Empty state renders.
26. Date range bounds apply.
27. No persisted report result table exists.
28. No generic operations item table exists.
29. No ranking or sales priority appears.
30. No client wealth, premium or revenue priority appears.
31. No automatic message is sent.
32. No external provider API call occurs on generic Reports read.
33. Card links enforce source authorization.
34. Section sorting is deterministic.
35. Mobile layout works.
36. Keyboard navigation works.
37. Focus states are visible.
38. No horizontal scrolling is required.
39. Relationship 360 remains operational.
40. Today remains operational.
41. Communications remain operational.
42. Google Calendar remains unchanged.
43. Legacy adviser portal remains operational.
44. Promotions Phase 9F.4 observation remains unchanged.
45. No Promotions Stage 6 appears.
46. Migrations remain unapplied.
47. Features remain disabled.
