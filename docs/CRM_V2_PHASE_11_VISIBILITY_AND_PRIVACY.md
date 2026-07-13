# CRM V2 Phase 11 — Visibility and Privacy

**Phase:** 11

---

## 1. Data minimization

Today cards expose only: safe title, summary, client display name, due date, severity, action label, and allowlisted route.

---

## 2. Excluded from cards

- Policy numbers, NRIC, financial values
- Premium, revenue, client wealth
- Advocacy score, ethnicity (in card text)
- Communication body, private notes
- Raw Google provider errors
- Work queue priority internals

---

## 3. Assignment scope

Advisers see only assigned relationships. Admin scope returns empty queue (deferred per Phase 10.2).

---

## 4. Feature-disabled state

When `crm_v2_today` disabled: no business data loaded; placeholder UI only.

---

## 5. Cross-adviser IDOR

Invalid or unassigned source IDs reveal nothing. Source workflows enforce authorization on navigation.

---

## 6. Ethnicity

Ethnicity may exist in moment source logic pre-confirmation but **never** appears in Today card text.

---

## 7. Cache

All Today API responses: `private, no-store`.
