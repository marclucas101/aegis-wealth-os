# Phase 9F.3 — Create Test Planning Output (UI path)

Use this path in **development or staging** to create at least one published planning output without editing Supabase directly.

## Prerequisites

- Adviser account with an **assigned client**
- Client has completed **Discover** (dashboard snapshot exists)
- For roadmap output: client has at least one **active roadmap item**
- Feature flags: `binder_export` enabled (for Meeting Packs verification)

## Shortest path — financial readiness snapshot

1. Sign in as the assigned adviser.
2. Open **My Clients** → select the client.
3. Open the **Meeting Packs** tab.
4. In readiness, find **Financial overview** → click **Create financial overview**.
5. On **Planning outputs**, click **Create draft** (if not already created).
6. Click **Mark reviewed**.
7. Confirm **Publish to client**.
8. Return via **Back to meeting packs** (or `?returnTab=meeting-packs`).
9. Click **Refresh readiness** — Financial overview should show **Published** and be selectable.
10. Select the section and click **Generate pack with N sections**.

## Alternative — client plan summary

1. Follow steps 1–3 above.
2. Click **Create planning position** on **Current planning position**.
3. Complete draft → review → publish on Planning outputs.
4. Return to Meeting Packs and generate with that section selected.

## Alternative — wealth roadmap

1. Ensure the client has roadmap items (Overview tab shows roadmap progress).
2. Meeting Packs → **Create wealth roadmap** → Planning outputs.
3. Create draft → review → publish.
4. Return and generate.

## What this does not require

- Manual `published_outputs` inserts
- Storage bucket uploads for planning outputs
- SQL or Supabase table edits

## Verification

- `GET /api/advisor/clients/[clientId]/binder-export/readiness` shows financial / plan / roadmap section `status: "available"` with a create/review/publish action beforehand.
- Generated binder appears in the Meeting Packs list with `generationStatus: ready`.
