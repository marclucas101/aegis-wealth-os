# CRM V2 Phase 10 — Template Governance

**Scope:** `crm_communication_templates` versioning, variable allowlist, compliance workflow, rendering safety, and separation from Phase 9E `governed_content`.

---

## 1. Purpose

CRM V2 templates provide **reusable, compliance-reviewed wording** for adviser drafts. They are distinct from Phase 9E `governed_content` (published insights and admin-approved publications).

| Artifact | SOT | Audience |
|----------|-----|----------|
| `crm_communication_templates` | Phase 10 operational drafts | Adviser workspace |
| `governed_content` | Phase 9E published content | Client insights feed |

Templates accelerate draft creation; they do not auto-publish or auto-send.

---

## 2. Template identity and versioning

| Column | Rule |
|--------|------|
| `template_key` | Stable logical name (e.g. `appointment_preparation_v1`) |
| `version` | Integer ≥ 1; unique with `template_key` |
| Constraint | `UNIQUE (template_key, version)` |

**Resolution on use:** When adviser supplies `templateKey` on create, server selects highest `version` where `active=true` AND `compliance_status=approved`.

**New version workflow (operator):** Insert new row with incremented `version`; prior versions may be set `active=false` without DELETE.

---

## 3. Categories (allowlisted)

| Category | Typical use |
|----------|-------------|
| `appointment_preparation` | Pre-meeting client prep |
| `appointment_follow_up` | Post-meeting follow-up |
| `service_request_update` | Service request status |
| `document_request` | Document collection |
| `protection_correction_request` | Protection data correction |
| `annual_review` | Review cycle communication |
| `relationship_moment_acknowledgement` | Moment acknowledgement (manual only) |
| `advocacy_consent_acknowledgement` | Advocacy consent context |
| `general_client_service_update` | General operational update |

Categories are CHECK-constrained in migration and TypeScript allowlist.

---

## 4. Compliance status

| Status | Adviser use |
|--------|-------------|
| `draft` | Not selectable |
| `pending_review` | Not selectable |
| `approved` | **Selectable** — only status exposed in workspace |
| `restricted` | Not selectable |
| `inactive` | Not selectable |

**API filter:** `GET /api/advisor-v2/communications/templates` returns `active=true` AND `compliance_status=approved` only.

**Seeded templates (migration 017):** Three templates inserted with `compliance_status=approved`, `active=true`.

---

## 5. Variable allowlist

Defined in `CRM_TEMPLATE_VARIABLE_ALLOWLIST`:

| Variable | Typical source |
|----------|----------------|
| `client_name` | Client display name |
| `adviser_name` | Adviser display name |
| `appointment_date` | Linked appointment |
| `request_reference` | Service request reference |
| `update_summary` | Adviser-entered summary |
| `document_name` | Document context |
| `moment_label` | Relationship moment label |

### 5.1 Validation rules

`validateTemplateVariables(schema, variables)`:

- Every key in `variables` must be in allowlist
- Every key in template `variable_schema` must be in allowlist
- Each variable value max **500 characters**

`renderTemplateBody(body, variables)`:

- Replaces `{{variable_name}}` tokens only
- Unknown tokens throw — rejected as unsafe
- Values HTML-escaped (`&`, `<`, `>`, `"`, `'`) before insertion

### 5.2 Rejection cases

| Input | Result |
|-------|--------|
| `templateVariables: { "account_number": "123" }` | 400 — unsafe variable |
| Body containing `{{script}}` without allowlist match | 400 on render |
| Value > 500 chars | 400 |

---

## 6. Template render flow

```text
Adviser POST draft with templateKey + templateVariables
  → Load latest approved template by key
  → validateTemplateVariables(schema, variables)
  → renderTemplateBody(body, variables)
  → Store rendered body on record; persist template_id + template_version
  → Domain event: template_rendered (or draft_created if no template)
```

Rendered body is stored on `crm_communication_records.safe_body` — adviser may still PATCH before transition.

---

## 7. Content bounds

| Field | Max length |
|-------|------------|
| Template `title` | 200 chars (DB CHECK) |
| Template `body` | 8000 chars (DB CHECK) |
| Record `safe_subject` | `CRM_V2_COMMUNICATIONS_MAX_SUBJECT_LENGTH` |
| Record `safe_body` | `CRM_V2_COMMUNICATIONS_MAX_BODY_LENGTH` |

---

## 8. DTO exposure

### Adviser — `AdviserCommunicationTemplateDto`

| Included | Excluded |
|----------|----------|
| `templateId`, `templateKey`, `category`, `channel` | `approved_by_user_id` |
| `title`, `bodyPreview` (120 chars) | Full body in list (preview only) |
| `variableSchema`, `complianceStatus`, `version`, `active` | Internal audit metadata |

### Record DTO

| Included | Excluded |
|----------|----------|
| `templateKey`, `templateVersion` | Raw `template_id` UUID in client APIs |
| Rendered `safeBodyPreview` | Template body source |

---

## 9. Governance separation from governed_content

| Concern | Template | Governed content |
|---------|----------|------------------|
| Approval path | Operator seed + future admin workflow | 9E admin/compliance publish |
| Client delivery | Only when adviser marks sent/logged with `client_visible` | Insights feed publication |
| FK link | `governed_content_id` optional on record | N/A |
| Auto-migration | **None** | Promotions migration tool remains 9E only |

Phase 10 does **not** copy `governed_content` rows into templates automatically.

---

## 10. Audit trail

| Action | Event |
|--------|-------|
| Draft from template | `template_rendered` |
| Draft without template | `draft_created` |
| Draft edit | `draft_updated` |
| Review transition | `review_requested`, `approved` |

Template table changes (operator) should be accompanied by audit log entries in future admin tooling — Phase 10 seeds via migration only.

---

## 11. Operator checklist

1. New template: insert with `compliance_status=pending_review` → review → set `approved`.
2. Breaking wording change: new `version` row; do not UPDATE body in place on approved rows.
3. Retire template: set `active=false` or `compliance_status=inactive`.
4. Never add variables outside `CRM_TEMPLATE_VARIABLE_ALLOWLIST` without code + migration update.

**Branch:** `crm-v2-10-communications`
