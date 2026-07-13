# CRM V2 Phase 11 — Manual Tests

**Phase:** 11  
**Route:** `/advisor-v2/today`

---

## Acceptance checklist

1. Today feature disabled blocks Today workspace.
2. Non-pilot adviser cannot access Today.
3. Adviser sees only assigned clients.
4. Cross-adviser source IDs reveal nothing.
5. Today read performs no writes.
6. Empty state renders.
7. Partial-source failure renders safely.
8. Schedule section shows today's appointments.
9. Preparation section links to appointment workspace.
10. Client request card links to service request.
11. Service commitment card links to service workspace.
12. Protection extraction card links to verification workspace.
13. Relationship moment card excludes ethnicity.
14. Review rhythm card links to relationship review.
15. Advocacy follow-up card excludes advocacy score.
16. Communication draft card excludes full private body.
17. Google sync failure card excludes raw provider error.
18. Work queue panel is read-only.
19. Queue completion routes to source workflow.
20. No generic Today item table exists.
21. No generic work-item table exists.
22. No sales ranking appears.
23. No client wealth, premium or revenue priority appears.
24. No ethnicity-based ordering appears.
25. No advocacy-score ordering appears.
26. No automatic message is sent.
27. No external provider API call occurs on Today read.
28. Card links enforce source authorization.
29. Section sorting is deterministic.
30. Bounded card limits apply.
31. Mobile layout works.
32. Keyboard navigation works.
33. Focus states are visible.
34. No horizontal scrolling is required.
35. Relationship 360 remains operational.
36. Appointments remain operational.
37. Service remains operational.
38. Protection remains operational.
39. Moments remain operational.
40. Advocacy remains operational.
41. Communications remain operational.
42. Google Calendar remains unchanged.
43. Legacy adviser portal remains operational.
44. Promotions Phase 9F.4 observation remains unchanged.
45. No Promotions Stage 6 appears.
46. Migrations remain unapplied (until operator applies).
47. Features remain disabled (until operator enables).

---

## Runtime notes

Mark runtime tests as passed only after execution in a pilot environment with flags enabled.
