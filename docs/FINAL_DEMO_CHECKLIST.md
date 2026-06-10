# Final Demo Checklist — Phase 4Z

**Date:** 2026-06-10  
**Purpose:** Rehearsal and day-of checklist for stakeholder demos.

**Related:** [Demo Environment](./DEMO_ENVIRONMENT.md) · [Demo Script](./DEMO_SCRIPT.md) · [Demo Data Dictionary](./DEMO_DATA_DICTIONARY.md) · [Seeding and Reset](./SEEDING_AND_RESET.md)

---

## Pre-demo setup

- [ ] Target DB is dev or staging — **not** production with real clients
- [ ] All migrations applied (including `202606100014`)
- [ ] `npm run final:check` passes
- [ ] `npm run qa:env` passes
- [ ] `npm run demo:seed` completes
- [ ] `npx tsx scripts/demo-login-guide.ts` — accounts confirmed
- [ ] `npm run dev` running (or staging URL accessible)
- [ ] Two browser profiles ready (client + advisor)
- [ ] [Demo Script](./DEMO_SCRIPT.md) printed or on second screen

---

## Seed data

- [ ] Six client personas seeded (`@aegis-demo.local`)
- [ ] Advisor assigned to Alex, Priya, James, Margaret, Sam
- [ ] Tasks, notes, review pipeline, file-quality gaps present
- [ ] Wealth Blueprint / Annual Review snapshots for Alex and Margaret
- [ ] Document vault **metadata** present (no Storage files required)
- [ ] Audit log sample entries from seed visible to admin

---

## Login accounts

| Role | Email | Password | Use in demo |
|------|-------|----------|-------------|
| Admin | `admin@aegis-demo.local` | `AegisDemo2026!` | Role / security segment |
| Advisor | `advisor@aegis-demo.local` | `AegisDemo2026!` | Command center + workspace |
| Client | `alex.tan@aegis-demo.local` | `AegisDemo2026!` | Complete journey, estate gap |
| Client | `sam.wei@aegis-demo.local` | `AegisDemo2026!` | Incomplete onboarding |
| Client | `priya.nair@aegis-demo.local` | `AegisDemo2026!` | High risk, overdue review |
| Client | `james.lee@aegis-demo.local` | `AegisDemo2026!` | Roadmap progress (optional) |
| Client | `margaret.ong@aegis-demo.local` | `AegisDemo2026!` | Review due, reports |

---

## Client walkthrough

### Alex Tan (primary — ~3 min)

- [ ] `/dashboard` — Shield Score, pillars, next best action
- [ ] `/discover` — completed profile; estate gap flags
- [ ] `/roadmap` — open estate/legacy items
- [ ] `/stress-testing` — scenario impact visible
- [ ] `/wealth-blueprint` — saved report; disclaimer visible
- [ ] `/document-vault` — insurance/CPF metadata; **no estate docs** (gap narrative)

### Sam Wei (contrast — ~2 min)

- [ ] Onboarding state — thin dashboard
- [ ] Contrast with Alex — “before Discover is complete”

**Talking point:** Client portal guides the journey; gaps surface in scores and roadmap.

---

## Advisor walkthrough

### Command center (~3 min)

Login: `advisor@aegis-demo.local`

- [ ] `/advisor` overview — client count, priority clients
- [ ] Review pipeline — Margaret (due), Priya (overdue)
- [ ] Tasks — due and overdue items
- [ ] Suggested follow-ups — file-quality driven
- [ ] File quality — Sam incomplete; Priya critical; Alex estate gap

### Client workspace (~2 min)

Open **Priya Nair** or **Margaret Ong**:

- [ ] Client summary — score, risk tier
- [ ] Notes — risk or review note visible
- [ ] Tasks — linked follow-ups
- [ ] Review status — pipeline state

**Talking point:** Advisor OS surfaces who needs attention and why.

---

## Admin walkthrough (~2 min)

Login: `admin@aegis-demo.local`

- [ ] `/admin` dashboard loads
- [ ] User list visible
- [ ] Role concept explained (client / advisor / admin)
- [ ] Optional: client assignment or audit log sample

**Talking point:** Admin is operational control — not day-to-day advisor workflow.

---

## Report export

- [ ] As Alex or Margaret: Export / Print from Wealth Blueprint or Annual Review
- [ ] Print preview — cover, scores, disclaimer block
- [ ] Browser Save as PDF produces readable output
- [ ] Advisor modal print route opens in new tab (optional)

**Talking point:** Browser-print MVP — server PDF is post-beta.

---

## Document vault

- [ ] Show metadata records (categories, labels)
- [ ] Explain estate gap on Alex — no will/estate category
- [ ] Upload consent language visible if demonstrating upload
- [ ] Clarify: demo seed uses metadata only; live upload works on staging with test file

---

## Security / role demo

- [ ] Client cannot access `/advisor` or `/admin` API data (403)
- [ ] Advisor sees only assigned clients
- [ ] Legal pages load with draft-template warning
- [ ] Consent banner on first visit (or reset localStorage for demo)
- [ ] Mention **Phase 4X RLS fix** — users cannot self-promote to admin (`202606100014`)
- [ ] Service role stays server-side — not in browser bundle

**Talking point:** Defense in depth — API guards + RLS + audit logs.

---

## Post-demo

- [ ] Q&A — reference [Beta Limitations](./BETA_LIMITATIONS_AND_RISKS.md) honestly
- [ ] Reset if needed: `npm run demo:clear -- --confirm` then `npm run demo:seed`
- [ ] Capture feedback for [Beta Roadmap](./BETA_ROADMAP_AFTER_LAUNCH.md)

---

## Demo go / no-go

- [ ] All sections above checked or consciously skipped with narrative
- [ ] No P0/P1 issues during rehearsal
- [ ] Sign-off per [Go / No-Go — Demo](./GO_NO_GO_CRITERIA.md#demo-go--no-go)
