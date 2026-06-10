# Demo Script — 10–15 Minute Walkthrough

**Audience:** Prospects, partners, internal stakeholders  
**Environment:** Dev/staging with `npm run demo:seed` completed  
**Guide:** [Demo Environment](./DEMO_ENVIRONMENT.md)

---

## Before you start (2 min)

1. Run `npm run demo:seed` and `npm run dev`
2. Open two browser profiles (or incognito + normal) for client vs advisor views
3. Keep [demo-login-guide](../scripts/demo-login-guide.ts) handy: `npx tsx scripts/demo-login-guide.ts`

---

## 1. Client view — complete journey (3 min)

**Login:** `alex.tan@aegis-demo.local` / `AegisDemo2026!`

1. **Dashboard** — Show Shield Score, pillar breakdown, AWRI, benchmark context
2. **Discover** — Note completed profile; point out high income, missing will/estate flags
3. **Roadmap** — Walk one or two open items (estate/legacy theme)
4. **Stress testing** — Run or view moderate severity scenarios
5. **Reports** — Open saved Wealth Blueprint (demo-labelled)

**Talking point:** “Alex is financially strong but estate planning is the gap — the roadmap and advisor notes align on this.”

---

## 2. Client view — incomplete journey (2 min)

**Login:** `sam.wei@aegis-demo.local`

1. Show **onboarding** state — limited dashboard data
2. Contrast with Alex — “This is what advisors see before Discover is complete”

**Optional:** Log in as `james.lee@aegis-demo.local` to show **roadmap progress** (items in progress vs completed).

---

## 3. Advisor command center (3 min)

**Login:** `advisor@aegis-demo.local`

1. **Overview** — Active client count, average score, priority clients
2. **Review pipeline** — Margaret (review due), Priya (overdue)
3. **Tasks** — Due and overdue items
4. **Suggested tasks** — File-quality and pipeline-driven suggestions
5. **File quality** — Sam incomplete; Priya critical gaps; Alex missing estate docs

**Talking point:** “The advisor OS surfaces who needs attention and why — not just a client list.”

---

## 4. Advisor client workspace (2 min)

Stay as advisor. Open **Priya Nair** or **Margaret Ong**.

1. Client summary — score, rating, risk
2. **Notes** — Risk note (Priya) or review note (Margaret)
3. **Tasks** — Linked follow-ups
4. **Review status** — Pipeline state and recommended action

---

## 5. Document vault demo (2 min)

As advisor, open **Alex Tan** document vault (or client login for Alex).

1. Show uploaded **metadata** records (insurance, CPF, investments)
2. Explain **estate gap** — no will/estate category on file
3. Note placeholders: “Demo uses metadata only — no real files in Storage”

---

## 6. Report export demo (2 min)

As **Alex** or **Margaret** (has reports):

1. Open **Wealth Blueprint** or **Annual Review**
2. Show print-ready layout / export
3. Reference executive summary and roadmap status in the report snapshot

---

## 7. Admin and security / role demo (2 min)

**Login:** `admin@aegis-demo.local`

1. Open **admin dashboard** — platform-level view
2. **Role contrast:** Log out; confirm `alex.tan@…` cannot access `/advisor` or `/admin`
3. Log in as advisor — confirm access to assigned clients only
4. Mention **RLS** and Phase 4X role-escalation fix (no self-promotion to admin)

**Talking point:** “Roles are enforced in the database and middleware — demo accounts illustrate the separation.”

---

## 8. Wrap-up (1 min)

- Reset anytime: `npm run demo:clear -- --confirm` then `npm run demo:seed`
- All data is fictional (`@aegis-demo.local`)
- Production deploy does **not** auto-seed

---

## Timing summary

| Segment | Minutes |
|---------|---------|
| Client complete (Alex) | 3 |
| Client incomplete (Sam) | 2 |
| Advisor dashboard | 3 |
| Client workspace | 2 |
| Document vault | 2 |
| Reports | 2 |
| Admin / security | 2 |
| **Total** | **~14** |

Adjust depth per audience; skip Sam or admin if time is short.
