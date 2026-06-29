# Phase 10.2 — Manual Tests

**Checkpoint:** 10.2 (domain only — no UI/API)  
**Environment:** Local/staging with fixture unit tests; optional adviser account for batch loader smoke

---

## Automated (required before 10.3)

- [ ] `npm run qa:phase10-work-queue-core` — 135 checks pass
- [ ] `lib/work-queue/workQueueUnitTests.ts` — all fixture scenarios pass
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build`

---

## Optional batch-loader smoke (staging, read-only)

1. Call `buildAdviserWorkQueue({ authUserId, userRole: "advisor" })` from a temporary script (not committed) in staging
2. Verify items only for assigned clients
3. Verify no financial amounts in JSON output
4. Verify `actionHref` values are under `/advisor`
5. Delete temporary script after verification

---

## Deferred to 10.3

- Advisor OS queue panel UI
- Production API route
- Feature flag activation
- Manual adviser pilot acceptance

---

## Sign-off

| Role | Checkpoint 10.2 |
|------|-----------------|
| Engineering | Domain model + adapters complete |
| Operator | Confirm no migration, no flag activation |
