# CRM V2 — Phase 02 Manual Tests

**Branch:** `crm-v2-02-relationship-360`  
**Prerequisite:** Staging with `crm_v2_master`, `crm_v2_pilot_mode`, `crm_v2_relationships` enabled and pilot user in `CRM_V2_PILOT_USER_IDS`

Mark each test **PASS** / **FAIL** / **NOT RUN** after execution.

---

| # | Test | Result |
|---|------|--------|
| 1 | CRM master disabled blocks Relationships | NOT RUN |
| 2 | Pilot gate blocks non-pilot adviser | NOT RUN |
| 3 | Relationship feature disabled blocks module | NOT RUN |
| 4 | Approved pilot adviser sees only assigned relationships | NOT RUN |
| 5 | Adviser A cannot see Adviser B's client | NOT RUN |
| 6 | Direct forged relationship ID reveals nothing | NOT RUN |
| 7 | Client cannot access Relationship 360 | NOT RUN |
| 8 | Relationship list search remains assignment-scoped | NOT RUN |
| 9 | Filters remain assignment-scoped | NOT RUN |
| 10 | Pagination remains stable | NOT RUN |
| 11 | Empty assigned book renders correctly | NOT RUN |
| 12 | Partial source failure shows safe warning | NOT RUN |
| 13 | Overview shows no fabricated data | NOT RUN |
| 14 | Financial Plan links open authoritative workflows | NOT RUN |
| 15 | Timeline entries are safe and correctly ordered | NOT RUN |
| 16 | Service items link to authoritative records | NOT RUN |
| 17 | Documents expose no storage path or signed URL | NOT RUN |
| 18 | Relationship Profile exposes no Phase 08/09 data prematurely | NOT RUN |
| 19 | Mobile layout works | NOT RUN |
| 20 | Keyboard and focus behavior works | NOT RUN |
| 21 | No source records change while viewing | NOT RUN |
| 22 | `/advisor` remains functional | NOT RUN |
| 23 | Client portal remains unchanged | NOT RUN |
| 24 | Feature-control migration remains unapplied | NOT RUN |
| 25 | Phase 9F.4 observation remains unchanged | NOT RUN |

---

## Notes

Automated acceptance (`npm run qa:crm-v2-relationship-360`) must pass before operator runtime testing.

Do not mark runtime tests as passed unless actually executed on staging or production pilot.
