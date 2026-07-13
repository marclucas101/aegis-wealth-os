# CRM V2 Phase 13 — Master Manual Acceptance Checklist

**Branch:** `crm-v2-13-pilot-activation`  
**Rule:** Do not mark tests **PASSED** unless executed on staging (or approved production pilot) with evidence.

**Source documents:** Phase 01–12 `CRM_V2_PHASE_*_MANUAL_TESTS.md` — aggregated here for pilot execution tracking.

---

## Pilot execution columns

| Column | Values |
|--------|--------|
| **Status** | NOT RUN / PASS / FAIL / BLOCKED |
| **Tester** | Operator name |
| **Date** | YYYY-MM-DD |
| **Evidence link** | Screenshot, log, ticket URL |
| **Notes** | Observations |
| **Blocker severity** | — / Low / Medium / High / Critical |

---

## A. Access and gating

*Source: Phase 01 (25 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| A01 | Migration baseline verified | NOT RUN | | | | | |
| A02 | Master disabled blocks `/advisor-v2` | NOT RUN | | | | | |
| A03 | Disabled access loads no business data | NOT RUN | | | | | |
| A04 | Master without pilot blocked | NOT RUN | | | | | |
| A05 | Empty pilot config blocked | NOT RUN | | | | | |
| A06 | Malformed pilot config blocked | NOT RUN | | | | | |
| A07 | Non-pilot adviser blocked | NOT RUN | | | | | |
| A08 | Pilot adviser opens shell | NOT RUN | | | | | |
| A09 | Pilot adviser placeholder routes | NOT RUN | | | | | |
| A10 | Client cannot access V2 | NOT RUN | | | | | |
| A11 | Unauthenticated denial | NOT RUN | | | | | |
| A12 | Admin non-adviser denied | NOT RUN | | | | | |
| A13 | Legacy has no V2 nav link | NOT RUN | | | | | |
| A14 | Legacy `/advisor` functional | NOT RUN | | | | | |
| A15 | Shell API gated | NOT RUN | | | | | |
| A16 | Allowlist change requires restart | NOT RUN | | | | | |
| A17 | Feature defaults fail-closed | NOT RUN | | | | | |
| A18 | Cross-adviser shell denial | NOT RUN | | | | | |
| A19 | Settings profile link-out | NOT RUN | | | | | |
| A20 | No horizontal scroll shell | NOT RUN | | | | | |
| A21 | Mobile shell layout | NOT RUN | | | | | |
| A22 | Keyboard focus shell | NOT RUN | | | | | |
| A23 | No client data in shell API | NOT RUN | | | | | |
| A24 | Phase 9F.4 unchanged | NOT RUN | | | | | |
| A25 | Security scripts pass | NOT RUN | | | | | |

---

## B. Adviser shell

*Consolidated from Phase 01 navigation and layout tests A08–A23*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| B01 | Primary nav labels correct | NOT RUN | | | | | |
| B02 | More nav (reports, operations, templates, settings) | NOT RUN | | | | | |
| B03 | `/advisor-v2` redirects to today when enabled | NOT RUN | | | | | |
| B04 | Domain pillars display | NOT RUN | | | | | |

---

## C. Relationships

*Source: Phase 02 (25 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| C01 | Master disabled blocks relationships | NOT RUN | | | | | |
| C02 | Pilot gate blocks non-pilot | NOT RUN | | | | | |
| C03 | Feature disabled blocks module | NOT RUN | | | | | |
| C04 | Pilot sees assigned relationships only | NOT RUN | | | | | |
| C05 | Adviser A cannot see Adviser B client | NOT RUN | | | | | |
| C06 | Forged relationship ID safe | NOT RUN | | | | | |
| C07 | Client cannot access Relationship 360 | NOT RUN | | | | | |
| C08 | Search assignment-scoped | NOT RUN | | | | | |
| C09 | Filters assignment-scoped | NOT RUN | | | | | |
| C10 | Pagination stable | NOT RUN | | | | | |
| C11 | Empty book renders | NOT RUN | | | | | |
| C12 | Partial source failure warning | NOT RUN | | | | | |
| C13 | Overview no fabricated data | NOT RUN | | | | | |
| C14 | Financial Plan links authoritative | NOT RUN | | | | | |
| C15 | Timeline safe and ordered | NOT RUN | | | | | |
| C16 | Service items link authoritative | NOT RUN | | | | | |
| C17 | Documents no storage path leak | NOT RUN | | | | | |
| C18 | Profile no premature Phase 08/09 data | NOT RUN | | | | | |
| C19 | Mobile layout | NOT RUN | | | | | |
| C20 | Keyboard focus | NOT RUN | | | | | |
| C21 | No source mutation on view | NOT RUN | | | | | |
| C22 | Legacy `/advisor` functional | NOT RUN | | | | | |
| C23 | Client portal unchanged | NOT RUN | | | | | |
| C24 | Feature migration state verified | NOT RUN | | | | | |
| C25 | 9F.4 observation unchanged | NOT RUN | | | | | |

---

## D. Appointments adviser

*Source: Phase 03 (34 tests) — abbreviated IDs; full steps in Phase 03 doc*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| D01–D34 | Phase 03 manual tests 1–34 | NOT RUN | | | | See `CRM_V2_PHASE_03_MANUAL_TESTS.md` | |

---

## E. Appointments client

*Source: Phase 04 (20 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| E01–E20 | Phase 04 manual tests 1–20 | NOT RUN | | | | See `CRM_V2_PHASE_04_MANUAL_TESTS.md` | |

---

## F. Google Calendar

*Source: Phase 05 (16 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| F01–F16 | Phase 05 manual tests 1–16 | NOT RUN | | | | Staging OAuth required | |

---

## G. Service

*Source: Phase 06 (38 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| G01–G38 | Phase 06 manual tests 1–38 | NOT RUN | | | | See `CRM_V2_PHASE_06_MANUAL_TESTS.md` | |

---

## H. Protection

*Source: Phase 07 (39 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| H01–H39 | Phase 07 manual tests 1–39 | NOT RUN | | | | See `CRM_V2_PHASE_07_MANUAL_TESTS.md` | |

---

## I. Relationship moments

*Source: Phase 08 (39 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| I01–I39 | Phase 08 manual tests 1–39 | NOT RUN | | | | See `CRM_V2_PHASE_08_MANUAL_TESTS.md` | |

---

## J. Advocacy

*Source: Phase 09 (42 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| J01–J42 | Phase 09 manual tests 1–42 | NOT RUN | | | | No Promotions Stage 6 | |

---

## K. Communications

*Source: Phase 10 (47 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| K01–K47 | Phase 10 manual tests 1–47 | NOT RUN | | | | No external send | |

---

## L. Today

*Source: Phase 11 (47 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| L01–L47 | Phase 11 manual tests 1–47 | NOT RUN | | | | Includes work queue | |

---

## M. Reports

*Source: Phase 12 (subset of 47 tests)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| M01 | Reports gate master+pilot+flag | NOT RUN | | | | | |
| M02 | Client denied reports | NOT RUN | | | | | |
| M03 | Adviser-scoped counts only | NOT RUN | | | | | |
| M04 | No policy numbers in cards | NOT RUN | | | | | |
| M05 | No advocacy score in reports | NOT RUN | | | | | |
| M06 | Partial adapter failure safe | NOT RUN | | | | | |
| M07 | Date range bounded | NOT RUN | | | | | |
| M08 | GET no writes | NOT RUN | | | | | |
| M09 | Admin book-wide deferred | NOT RUN | | | | | |
| M10 | Legacy reports unchanged | NOT RUN | | | | | |

---

## N. Operations

*Source: Phase 12 (subset)*

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| N01 | Operations gate | NOT RUN | | | | | |
| N02 | Feature controls panel safe fields | NOT RUN | | | | | |
| N03 | No secrets in operations DTO | NOT RUN | | | | | |
| N04 | Migration visibility manual runbook | NOT RUN | | | | | |
| N05 | Google calendar panel no tokens | NOT RUN | | | | | |
| N06 | GET no writes | NOT RUN | | | | | |
| N07 | Client denied operations | NOT RUN | | | | | |
| N08 | Action required aggregation | NOT RUN | | | | | |

---

## O. Cross-module integration

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| O01 | Today pulls appointments adapter | NOT RUN | | | | | |
| O02 | Today pulls service adapter | NOT RUN | | | | | |
| O03 | Reports work queue virtual summary | NOT RUN | | | | | |
| O04 | Operations Today health panel | NOT RUN | | | | | |
| O05 | Service request links protection | NOT RUN | | | | | |
| O06 | Advocacy links appointments | NOT RUN | | | | | |
| O07 | Communications consent check | NOT RUN | | | | | |
| O08 | Legacy `/advisor` parallel operation | NOT RUN | | | | | |
| O09 | Phase 10.2 queue remains virtual | NOT RUN | | | | | |
| O10 | 9F.4 promotions observation active | NOT RUN | | | | | |

---

## P. Rollback

| ID | Test | Status | Tester | Date | Evidence | Notes | Blocker |
|----|------|--------|--------|------|----------|-------|---------|
| P01 | Disable single module — route blocked | NOT RUN | | | | | |
| P02 | Disable master — full lockout | NOT RUN | | | | | |
| P03 | Clear allowlist — all denied | NOT RUN | | | | | |
| P04 | Client-visible flag off — client denied | NOT RUN | | | | | |
| P05 | Google calendar disable — no sync | NOT RUN | | | | | |
| P06 | Data retained after rollback | NOT RUN | | | | | |
| P07 | Legacy `/advisor` after rollback | NOT RUN | | | | | |
| P08 | Discrepancy SQL empty post-rollback | NOT RUN | | | | | |
| P09 | No destructive SQL used | NOT RUN | | | | | |
| P10 | Operator incident log if FAIL | NOT RUN | | | | | |

---

## Q. Production go/no-go (operator only)

| ID | Criterion | Status | Tester | Date | Evidence | Notes | Blocker |
|----|-----------|--------|--------|------|----------|-------|---------|
| Q01 | All staging sections A–P PASS | NOT RUN | | | | | |
| Q02 | Staging pilot ≥ 5 business days | NOT RUN | | | | | |
| Q03 | No Critical/High open blockers | NOT RUN | | | | | |
| Q04 | Security review signed | NOT RUN | | | | | |
| Q05 | Data safety checklist complete | NOT RUN | | | | | |
| Q06 | Rollback drill executed on staging | NOT RUN | | | | | |
| Q07 | Production `CRM_V2_PILOT_USER_IDS` planned | NOT RUN | | | | | |
| Q08 | Executive go/no-go decision recorded | NOT RUN | | | | | |

**Production activation is out of Phase 13 scope.** This section prepares operator decision tracking only.

---

## Summary counts

| Group | Tests | Passed | Failed | Not run |
|-------|-------|--------|--------|---------|
| A Access | 25 | 0 | 0 | 25 |
| B Shell | 4 | 0 | 0 | 4 |
| C Relationships | 25 | 0 | 0 | 25 |
| D Appointments adviser | 34 | 0 | 0 | 34 |
| E Appointments client | 20 | 0 | 0 | 20 |
| F Google Calendar | 16 | 0 | 0 | 16 |
| G Service | 38 | 0 | 0 | 38 |
| H Protection | 39 | 0 | 0 | 39 |
| I Moments | 39 | 0 | 0 | 39 |
| J Advocacy | 42 | 0 | 0 | 42 |
| K Communications | 47 | 0 | 0 | 47 |
| L Today | 47 | 0 | 0 | 47 |
| M Reports | 10 | 0 | 0 | 10 |
| N Operations | 8 | 0 | 0 | 8 |
| O Cross-module | 10 | 0 | 0 | 10 |
| P Rollback | 10 | 0 | 0 | 10 |
| Q Production go/no-go | 8 | 0 | 0 | 8 |
| **Total** | **422** | **0** | **0** | **422** |

---

## Execution order (recommended)

1. A Access and gating
2. B Shell
3. Enable modules per activation order; run C→N per module
4. O Cross-module (after multiple modules enabled)
5. P Rollback drill on staging
6. Q Production go/no-go (when staging complete)

**Do not mark passed without evidence.**
