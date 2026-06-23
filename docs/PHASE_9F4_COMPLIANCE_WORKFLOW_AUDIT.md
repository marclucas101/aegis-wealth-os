# Phase 9F.4 — Compliance Workflow Audit

**Checkpoint:** 9F.4 Checkpoint 1 (audit only)  
**Branch:** `phase-9f4-compliance-promotions-retirement`

## Scope

Traces content and publication workflows from draft through audit and notification. Identifies which actions require **independent compliance approval** vs **adviser-controlled** operation.

**Policy constraint (checkpoint):** Do not add compliance approval to client-specific operational documents unless operator policy requires it.

---

## Workflow matrix — governed communications (Phase 9E)

**Primary modules:** `lib/communications/contentWorkflow.ts`, `lib/supabase/governedContentPersistence.ts`  
**Approver actor:** Admin (`requireAdminAccess` + `admin_content_approval` flag)

| Step | Current actor | Permitted roles | Required state | API route | Persistence | Audit action | Feature control | Auth gap | UI gap |
|------|---------------|-----------------|----------------|-----------|-------------|--------------|-----------------|----------|--------|
| Content draft | Adviser author | `advisor`, `admin` | — | `POST /api/advisor/insights` | `dbCreateGovernedContent` | `content_draft_created` | `adviser_insight_authoring` | None | Adviser insights UI |
| Adviser edit draft | Author | Same + ownership | `draft` / `changes_requested` | `PATCH .../insights/[contentId]` | `dbUpdateGovernedContent` | varies | same | None | Same |
| Submit for review | Author | Same | `draft` | `POST .../submit` | status → `submitted_for_review` | `content_submitted` | same | None | Same |
| Compliance review | **Admin** | `admin` only | `submitted_for_review` | Admin comms workspace | — | — | `admin_content_approval` | No separate compliance role | Admin UI exists |
| Approve | **Admin** | `admin` | `submitted_for_review` | `POST /api/admin/communications/[contentId]/approve` | `approveContent` | `content_approved` | `admin_content_approval` | Author cannot self-approve (enforced) | Admin UI |
| Reject | **Admin** | `admin` | submitted | `.../reject` | status → `rejected` | `content_rejected` | same | None | Admin UI |
| Request changes | **Admin** | `admin` | submitted | `.../request-changes` | → `changes_requested` | `content_changes_requested` | same | None | Admin UI |
| Schedule | **Admin** | `admin` | approved | `.../schedule` | `scheduled_at` set | `content_scheduled` | `scheduled_content_automation` (job) | Job disabled by default | Admin UI |
| Publish | **Admin** | `admin` | approved / schedule due | `.../publish` or automation job | `publishContent` | `content_published` | `admin_content_approval` | None | Admin UI |
| Withdraw | **Admin** | `admin` | published | `.../withdraw` | `withdrawn_at` | `content_withdrawn` | same | None | Admin UI |
| Supersede | **Admin** (via new version) | `admin` | published | new version workflow | version lineage | lifecycle notification | same | None | Admin UI |
| Expire | System / admin | — | past `expires_at` | lifecycle helpers | status update | `content_expired` | — | — | — |
| Client delivery | System | — | `published` | `insightsFeedService` | read `governed_content` | — | `insights_and_updates` | Client prefs filter | `/insights` |
| Notification | System | — | on publish | `deliverPublicationNotifications` | `communication_deliveries` | delivery records | `client_in_app_notifications` | — | Client notification centre |

**Genuinely requires independent compliance approval:** Firm-wide **financial publications**, **campaign/promotional communications**, **market updates**, and **product-related content** when published to client audiences via governed content.

**Classification:** `promotional_product` blocked unless `product_related_content` enabled (default **off**).

---

## Workflow matrix — planning outputs (Phase 9A)

**Primary module:** `lib/compliance/publicationWorkflow.ts`  
**Actor:** Assigned adviser or admin

| Step | Actor | Roles | State | API | Persistence | Audit | Feature | Gap |
|------|-------|-------|-------|-----|-------------|-------|---------|-----|
| Prepare | Adviser | assigned + `canPublishClientOutput` | — | `POST .../publications` | `prepareClientSafeOutput` | prepare actions | `adviser_publication_workflow` | None |
| Adviser review | Adviser/admin | same | `draft` → `adviser_reviewed` | `POST .../review` | `reviewPublishedOutput` | review | same | **Adviser-controlled by design** |
| Publish | Adviser/admin | same | `adviser_reviewed` | `POST .../publish` | `publishOutput` | publish + lifecycle | same | None |
| Withdraw | Adviser/admin | same | published | withdraw routes | `withdrawOutput` | withdrawn | same | None |
| Supersede | System on publish | — | published | publish flow | lineage | lifecycle notification | — | None |
| Expire | System | — | past expiry | `expireOutput` | — | — | — | — |

**Independent compliance approval:** **Not required** for client-specific planning outputs (roadmap summary, financial overview, etc.) — adviser review + publish is the governed model.

---

## Workflow matrix — binder export (Phase 9F.3)

**Primary module:** `lib/binder/binderPublicationService.ts`  
**Actor:** Assigned adviser or admin

| Step | Actor | Roles | State | API | Feature | Compliance? |
|------|-------|-------|-------|-----|---------|-------------|
| Generate PDF | Adviser | assigned | `generating` → `ready` | binder-export routes | `binder_export` | No |
| Publish to vault | Adviser | assigned + confirm | `ready` | `.../binder-exports/[id]/publish` | `binder_client_publication` (default off) | **No** — client-specific operational document |
| Withdraw | Adviser | assigned | published | `.../withdraw` | same | No |
| Client access | Client | entitlement | published doc | document vault | `documents` | No |

**Policy alignment:** Meeting packs / binder PDFs are **client-specific operational documents** — adviser-controlled publication is appropriate.

---

## Workflow matrix — legacy promotions

**Primary module:** `lib/supabase/promotionsPersistence.ts`  
**Actor:** Any adviser or admin

| Step | Actor | Roles | State | API | Audit | Compliance? |
|------|-------|-------|-------|-----|-------|-------------|
| Create | Adviser | `requireAdvisorAccess` | `draft` | `POST /api/advisor/promotions` | `promotion_created` | **No approval** |
| Edit | Adviser | same | any | `PATCH .../[promotionId]` | `promotion_updated` | **No** |
| Publish | Adviser | same | → `published` | PATCH status | `promotion_published` | **Gap — self-publish** |
| Archive | Adviser | same | → `archived` | PATCH | varies | No |
| Client view | Client | authenticated | published + dates | `GET /api/promotions` | — | **Ungoverned** — RLS only |
| Migration to governed | Admin | `admin_content_approval` | — | `POST /api/admin/promotions-migration` | `promotion_migration_draft_created` | Partial — creates draft only |

**Classification:** Legacy promotions path is **replace before removal** — lacks compliance approval and overlaps Phase 9E.

---

## Workflow matrix — scheduled publishing (Phase 9F)

**Job:** `lib/jobs/scheduledContentEligibility.ts` → `publishContent`  
**Target:** `governed_content` only — **does not read `promotions` table**

| Step | Actor | Control |
|------|-------|---------|
| Eligibility check | Automation (service role) | Re-validates approval, author≠approver, audience |
| Publish | `publishContent` | Same as manual admin publish |
| Notify | `deliverPublicationNotifications` | Lifecycle notifications |

---

## Workflow matrix — lifecycle notifications (Phase 9F.2)

Wired from `publicationWorkflow.ts`, `contentWorkflow.ts`, document events. **No promotion-specific notification events** found in lifecycle catalog.

---

## Explicit content-type review

| Content type | Workflow | Compliance approval required? |
|--------------|----------|------------------------------|
| Financial publications (governed insights) | Phase 9E admin approve | **Yes** — firm-wide |
| Campaign / promotional communications | Phase 9E; `promotional_product` gated | **Yes** |
| Client-specific meeting packs (binder) | Adviser publish | **No** (policy) |
| Scheduled publishing | Phase 9F on `governed_content` | **Yes** (inherits approval) |
| Lifecycle notifications | Post-publish delivery | N/A (downstream) |
| Adviser-created planning outputs | Adviser review + publish | **No** — adviser review suffices |
| Document publication (vault) | Adviser upload + visibility rules | **No** — operational |
| Legacy promotions | Adviser self-publish | **Should require compliance** — **gap** |

---

## Missing authorization summary

| Gap | Severity | Classification |
|-----|----------|----------------|
| Legacy promotion publish without admin approval | High | **Replace before removal** |
| `GET /api/promotions` without entitlement check | Medium | **Replace before removal** |
| Any adviser can edit any promotion (no `created_by` scope) | Medium | **Safe to deprecate** with retirement |
| No admin UI for promotions migration API | Low | **Unknown / operator decision** |

---

## Missing operator UI

| Capability | API exists | UI exists |
|------------|------------|-----------|
| Governed content approval | Yes | Yes (`AdminCommunicationsClient`) |
| Promotions migration | Yes (`/api/admin/promotions-migration`) | **No** |
| Legacy promotion manager | Yes | Yes (`/advisor/promotions`) |
| Client promotions feed | Yes | Dormant (`/promotions` hidden) |

---

## Classification summary

| Workflow | Classification |
|----------|----------------|
| Phase 9E governed communications | **Actively required** |
| Phase 9A planning outputs | **Actively required** |
| Phase 9F.3 binder publication | **Actively required** |
| Phase 9F scheduled publishing | **Actively required** (governed_content only) |
| Legacy promotions publish path | **Replace before removal** |
| Promotions migration API | **Safe to deprecate** after data migrated |
| Admin-as-compliance-approver | **Actively required** (current policy) |
