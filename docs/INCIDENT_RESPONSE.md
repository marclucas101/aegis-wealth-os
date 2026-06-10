# Incident Response — Phase 4W

**Date:** 2026-06-10  
**Purpose:** Severity definitions, first-response steps, and post-incident process for Aegis Wealth OS.

**Related:** [Operations Runbook](./OPERATIONS_RUNBOOK.md) · [Backup & Recovery](./BACKUP_AND_RECOVERY.md) · [Monitoring & Logging](./MONITORING_AND_LOGGING.md)

---

## 1. Severity levels

| Level | Name | Examples | Response target |
|-------|------|----------|-----------------|
| **SEV-1** | Critical | Total outage; auth broken for all users; suspected data breach; storage/DB unavailable | Immediate — all hands |
| **SEV-2** | Major | Core client/advisor flows failing (upload, discover save, login for subset); sustained 5xx > 5% | < 1 hour |
| **SEV-3** | Minor | Single route failing; elevated 429; audit log write failures; non-critical feature degraded | < 4 hours |
| **SEV-4** | Low | Cosmetic issue; intermittent preview-only bug; doc gap | Next business day |

When in doubt, classify **up** until impact is understood.

---

## 2. First 15 minutes

1. **Acknowledge** — Assign incident lead and scribe (even solo — note times in a doc).
2. **Triage severity** using §1.
3. **Health probes:**
   ```bash
   curl -s https://<host>/api/health/app
   curl -s https://<host>/api/health/supabase
   ```
4. **Check recent deploys** — Vercel last deployment time vs incident start.
5. **Scan logs** — Vercel (5xx, `level":"error"`) and Supabase (Auth, Postgres, Storage).
6. **User impact** — Can clients log in? Can advisors access assigned clients? Is PII exposed?
7. **Communicate** — Internal stakeholders first; user-facing status only if SEV-1/2 (see §4).
8. **Do not** paste secrets, service role keys, or full JWTs into Slack/email/tickets.

---

## 3. Containment

| Scenario | Containment action |
|----------|-------------------|
| Bad deploy | Roll back Vercel to last green deployment |
| Migration failure | Stop traffic; restore DB from pre-migration backup ([Backup & Recovery](./BACKUP_AND_RECOVERY.md)) |
| Auth compromise suspected | Rotate Supabase keys; force session invalidation; review `audit_logs` |
| Abuse / rate-limit storm | Identify route + IP; consider WAF/Vercel firewall rules |
| Storage malware / bad upload | Disable upload route via deploy freeze; quarantine object paths in Supabase Storage |
| Data leak via logs | Stop verbose logging deploy; redact retained logs per provider policy |

Preserve evidence: export relevant Vercel log window and Supabase log snippets (redacted) before rollback if investigating root cause.

---

## 4. Communication

### Internal

- Single thread (Slack/email) with: severity, impact, current hypothesis, next update time.
- Update every **30 min** for SEV-1, **60 min** for SEV-2 until resolved.

### External (users / advisors)

- SEV-1/2 only — brief status: what is affected, what is not, ETA if known, workaround if any.
- No technical jargon (RLS, service role, migration IDs).
- After resolution: all-clear + apology if data impact.

### Regulatory / legal

- If PII/financial data breach suspected → invoke legal/compliance contact from [Legal & Compliance Notes](./LEGAL_COMPLIANCE_NOTES.md).
- Do not notify users of breach until legal guidance (template not in scope for Phase 4W).

---

## 5. Resolution and verification

1. Apply fix or rollback.
2. Confirm health endpoints green.
3. Run targeted manual tests ([Post-Deployment QA](./POST_DEPLOYMENT_QA.md) subset).
4. Run `BASE_URL=https://<host> npm run qa:smoke` if unauthenticated paths affected.
5. Monitor logs 30–60 minutes for recurrence.
6. Downgrade severity and close incident thread.

---

## 6. Post-incident review (PIR)

Within **5 business days** for SEV-1/2; optional for SEV-3.

| Section | Content |
|---------|---------|
| Timeline | Detection → mitigation → resolution (UTC) |
| Impact | Users affected, duration, data touched |
| Root cause | Technical and process factors |
| What went well | |
| What to improve | |
| Action items | Owner + due date (monitoring, tests, runbook updates) |

Store PIR in team wiki — link from this doc’s revision history if needed.

---

## 7. Security incident checklist

Use when unauthorized access, key leak, or suspicious `audit_logs` activity is suspected:

- [ ] Confirm severity SEV-1; notify security/compliance lead
- [ ] Identify exposure window (logs + audit timestamps)
- [ ] Rotate Supabase anon + service_role keys; update Vercel env; redeploy
- [ ] Review [Audit Log Review](./AUDIT_LOG_REVIEW.md) queries for exfiltration patterns
- [ ] Check for new admin roles or advisor reassignments
- [ ] Review Storage for unexpected objects or mass downloads
- [ ] Preserve redacted log exports for investigation
- [ ] Legal/compliance decision on user notification
- [ ] Update [Security Test Plan](./SECURITY_TEST_PLAN.md) with new regression case if applicable

---

## 8. Playbook quick links

| Issue | Runbook section |
|-------|-----------------|
| Upload failures | [Operations Runbook §5](./OPERATIONS_RUNBOOK.md#5-common-failure-playbooks) |
| Auth failures | [Operations Runbook §5](./OPERATIONS_RUNBOOK.md#5-common-failure-playbooks) |
| API 500s | [Operations Runbook §5](./OPERATIONS_RUNBOOK.md#5-common-failure-playbooks) |
| Rate limits | [Operations Runbook §5](./OPERATIONS_RUNBOOK.md#5-common-failure-playbooks) |
| Restore | [Backup & Recovery §7](./BACKUP_AND_RECOVERY.md#7-restore-testing) |

---

## 9. On-call readiness (pre beta)

- [ ] Severity table agreed with team
- [ ] Primary on-call named in [Operations Runbook](./OPERATIONS_RUNBOOK.md#8-contacts-and-ownership-fill-before-go-live)
- [ ] Vercel + Supabase dashboard access for on-call
- [ ] Rollback steps tested once on staging
- [ ] Security incident checklist printed or bookmarked
