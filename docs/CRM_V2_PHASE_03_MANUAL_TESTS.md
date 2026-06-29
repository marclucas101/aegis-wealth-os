# CRM V2 Phase 03 — Manual Tests

**Environment:** Staging with pilot adviser  
**Note:** Mark pass only when actually executed.

---

1. [ ] Master disabled blocks appointments
2. [ ] Pilot gate blocks non-pilot adviser
3. [ ] Appointment feature disabled blocks module
4. [ ] Approved pilot adviser sees assigned appointments only
5. [ ] Adviser A cannot create for Adviser B's client
6. [ ] Adviser A cannot open Adviser B's appointment
7. [ ] Forged appointment ID reveals nothing
8. [ ] Adviser can create appointment for assigned relationship
9. [ ] Invalid date range rejected
10. [ ] Invalid timezone rejected
11. [ ] Template initializes preparation checklist
12. [ ] Appointment detail loads safely
13. [ ] Valid lifecycle transitions work
14. [ ] Invalid transition performs no write
15. [ ] Rescheduling keeps same appointment ID
16. [ ] Rescheduling records prior schedule in history
17. [ ] Stale update returns safe conflict
18. [ ] Repeated transition does not duplicate history
19. [ ] Meeting Studio link uses same client and adviser
20. [ ] Meeting Studio does not create another appointment
21. [ ] Binder status read safely
22. [ ] No storage paths or signed URLs in UI
23. [ ] Adviser agenda not exposed to client APIs
24. [ ] Client cannot access adviser appointment routes
25. [ ] No Google event created from CRM V2 Phase 03
26. [ ] No client appointment UI
27. [ ] Legacy adviser appointments operational
28. [ ] Existing appointment rows readable
29. [ ] Mobile layout works
30. [ ] Keyboard navigation works
31. [ ] GET requests perform no writes
32. [ ] Migrations unapplied in dev until operator apply
33. [ ] Features remain disabled until operator enable
34. [ ] Phase 9F.4 observation unchanged
