# CRM V2 Phase 13 — Day 1 Client Script

**Audience:** Pilot adviser inviting **one** low-risk real client  
**Channel:** WhatsApp or personal email — **not** CRM automated send on Day 1  
**Tone:** Calm, premium, honest — no hype, no guarantees

---

## 1. Short WhatsApp message (invite)

> Hi [First name], we're quietly testing a small upgrade to your AEGIS client portal — appointment viewing and requests — with a handful of clients first.  
>  
> Would you be open to trying it this week? It takes about 10 minutes. If anything feels unclear, just message me directly and we'll switch you back to the usual process.  
>  
> Login: [your usual AEGIS client portal link]  
>  
> Thank you — your feedback really helps us improve.

---

## 2. Slightly more premium version (email or WhatsApp)

> Dear [First name],  
>  
> We are running a **limited pilot** of an improved client experience for appointments — by invitation only, one step at a time.  
>  
> You would use your **existing secure login**. We are not changing your adviser relationship or moving everything to a new system overnight.  
>  
> If you are willing, please try the steps below when convenient. If something does not work, contact me directly — we can pause or revert immediately.  
>  
> Portal: [link]  
>  
> With appreciation,  
> [Adviser name]

---

## 3. Simple client instructions

Send **after** they agree. Adjust routes to match **only** flags you enabled.

**If client appointments are enabled:**

1. Log in to your AEGIS client portal as usual.
2. Open **Appointments** from the menu.
3. Check that you see **only your** upcoming or past meetings.
4. If offered, try **Request an appointment** with a simple note (e.g. "Pilot test — preferred time next week").
5. Tell your adviser if any screen says "unavailable" or shows information that is not yours.

**If service requests are enabled (optional Day 1):**

6. Open **Service requests** (or **Requests**).
7. Submit one short test request labelled "Pilot test" if you wish.
8. Confirm you cannot see other clients' information.

**Do not ask the client to:**

- Install new apps
- Connect Google Calendar (unless you explicitly arranged this separately)
- Share passwords or NRIC in chat
- Test messages, protection summaries, or preferences unless you enabled those modules

---

## 4. What the client should test

| Task | Enabled when |
|------|----------------|
| Log in successfully | Always |
| View own appointments | `crm_v2_appointments_client` |
| Submit one appointment request (optional) | same |
| View own service requests | `crm_v2_client_service` |
| Confirm nothing looks like someone else's data | Always |

---

## 5. What the client should not test yet

- Bulk invites to family members
- Protection policy details (unless explicitly enabled and adviser supervised)
- Messaging / inbox (unless explicitly enabled — **not recommended Day 1**)
- Advocacy or preference screens with sensitive fields
- Any link to an "adviser" or admin area
- Connecting third-party calendars without adviser guidance

---

## 6. Follow-up questions (ask within 24–48 hours)

1. Did login work as usual?
2. Could you find **Appointments** (and **Requests**, if applicable)?
3. Did you see **only your** information?
4. Was anything confusing, slow, or missing?
5. Did you receive any unexpected email or message from the system?
6. Would you be comfortable using this for a real appointment request in future — yes/no/unsure?
7. Anything you would not want shown on a client screen?

Record answers in go/no-go checklist and issue log if needed.

---

## 7. Escalation wording (if something does not work)

**To client:**

> Thank you for trying this — please stop using the new appointment section for now and use our usual process (message or call me). We have paused the pilot on our side. Your existing portal and data are safe.

**Internal (operator/adviser):**

- Log incident in `docs/CRM_V2_PHASE_13_PILOT_ISSUE_LOG.md`
- Follow rollback tree in `docs/CRM_V2_PHASE_13_DAY_1_REAL_CLIENT_PILOT.md`
- Do not ask client to retry sensitive steps until adviser confirms fix

---

## 8. Language to avoid

| Avoid | Use instead |
|-------|-------------|
| "Guaranteed" / "bug-free" | "Limited pilot" / "we're testing carefully" |
| "New platform" / "replacement" | "Small upgrade" / "existing login" |
| "Everyone is moving" | "Invitation only" |
| "Act now" urgency | "When convenient" |
| Promising specific features not enabled | Only describe enabled routes |

---

**Reminder:** This script does not enable any feature flags. Operator enables modules separately per `CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md`.
