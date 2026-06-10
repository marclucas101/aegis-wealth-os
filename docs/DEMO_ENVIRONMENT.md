# Demo Environment — Phase 4Y

**Purpose:** Safe, repeatable demo setup with fictional data for sales, QA, and stakeholder walkthroughs.

**Related:** [Demo Script](./DEMO_SCRIPT.md) · [Demo Data Dictionary](./DEMO_DATA_DICTIONARY.md) · [Seeding and Reset](./SEEDING_AND_RESET.md) · [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md) · [Final Beta Launch Checklist](./FINAL_BETA_LAUNCH_CHECKLIST.md)

---

## Prerequisites

1. Supabase project connected (dev or staging — **not production with real clients**)
2. All migrations applied
3. `.env.local` configured with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. `npm run qa:env` passes

---

## Setup steps

```bash
# 0. Structural launch gate (optional but recommended)
npm run final:check

# 1. Verify environment
npm run qa:env

# 2. Seed fictional demo data (manual only)
npm run demo:seed

# 3. Print login accounts
npx tsx scripts/demo-login-guide.ts

# 4. Start the app
npm run dev
```

To refresh scoring snapshots after formula changes (without clearing users):

```bash
npm run demo:seed -- --force
```

---

## Login accounts

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Admin | `admin@aegis-demo.local` | `AegisDemo2026!` | Role/access demo, admin dashboard |
| Advisor | `advisor@aegis-demo.local` | `AegisDemo2026!` | Advisor command center, client workspace |
| Client | `alex.tan@aegis-demo.local` | `AegisDemo2026!` | Complete journey, estate gap |
| Client | `priya.nair@aegis-demo.local` | `AegisDemo2026!` | High risk, overdue review |
| Client | `james.lee@aegis-demo.local` | `AegisDemo2026!` | Young family, roadmap progress |
| Client | `margaret.ong@aegis-demo.local` | `AegisDemo2026!` | Review due, reports on file |
| Client | `sam.wei@aegis-demo.local` | `AegisDemo2026!` | Incomplete onboarding |

All personas use the `@aegis-demo.local` domain. Data is entirely fictional.

---

## What each persona shows

### Admin (`admin@aegis-demo.local`)

- Admin dashboard access
- Cross-role visibility for security demos
- Sample audit log entries from demo seed

### Advisor (`advisor@aegis-demo.local`)

- **Active clients:** Alex, Priya, James, Margaret
- **Onboarding:** Sam Wei
- **Review due:** Margaret Ong (`review_due` status, 13-month-old review)
- **Overdue / high risk:** Priya Nair (16-month review, concentration risk, low readiness)
- **Tasks due:** Mix of open, in-progress, and overdue advisor tasks
- **Suggested follow-ups:** Driven by file-quality gaps, Discover gaps, review pipeline
- **File-quality gaps:** Sam (no Discover), Priya (thin documents), Alex (no estate docs)

### Alex Tan — complete journey, estate gap

- Full Discover → Shield → roadmap chain
- Strong overall score; **legacy/estate** is the weak pillar (no will)
- Document vault: insurance, investment, CPF — **no estate documents**
- Wealth blueprint on file

### Priya Nair — business owner, concentration risk

- Business income, cash-heavy allocation, informal succession
- Lower Shield Score / higher risk tier
- **Overdue** annual review (16 months)
- Pinned risk advisor note; urgent overdue task
- Minimal document coverage (business ownership only)

### James Lee — young family, protection gap

- Protection and disability gaps
- **Roadmap progress:** emergency fund completed; protection items in progress
- Moderate Shield Score

### Margaret Ong — pre-retiree, review due

- Retirement income / preserve pillar stress
- Client status `review_due`
- Annual review + Wealth Blueprint saved (demo-labelled)
- Fuller document vault metadata

### Sam Wei — thin onboarding

- Status `onboarding`, step `discover_started`
- **No** Discover profile or scores
- Drives onboarding queue and file-quality “incomplete” state

---

## Reset steps

```bash
# Shows warning; requires explicit confirmation
npm run demo:clear -- --confirm

# Re-seed
npm run demo:seed
```

See [Seeding and Reset](./SEEDING_AND_RESET.md) for safety rules and troubleshooting.

---

## Safety notes

- Demo seed scripts are **manually invoked only** — they never run on deploy or `npm run build`
- Do not run `demo:seed` against a database with real client data
- Do not run `demo:clear` without `--confirm`
- Document vault entries are **metadata placeholders** — no files are uploaded to Storage
