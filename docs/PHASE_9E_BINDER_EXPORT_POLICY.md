# Phase 9E Binder Export Policy

## Purpose

Generate a versioned adviser meeting pack using approved published summaries and permitted documents.

## Sections (selectable)

`cover_page`, `client_adviser_info`, `meeting_date`, `financial_overview`, `my_plan`, `agreed_priorities`, `roadmap`, `meeting_summary`, `document_index`, `next_review_date`

## Rules

1. Adviser-only generation — `resolveAccessibleClient()` assignment validation.
2. Only adviser-approved or client-published content (`isCurrentPublishedOutput`).
3. Internal notes and hidden Meeting Studio sections excluded.
4. Generated artefact stored adviser-internal by default (`binder_exports.status = generated`).
5. Client access requires explicit publication (`binder_client_publication` feature — default **off**).
6. Version, generation date, source publication IDs and adviser recorded.
7. Download audited (`binder_generated`, `binder_downloaded`).
Phase 9E produces a **binder export manifest** (database record with section list, approved publication IDs, adviser/client metadata, and storage path placeholder). It does **not** render a PDF in Phase 9E. Full PDF rendering and client vault publication remain deferred.

## API

`POST /api/advisor/clients/[clientId]/binder-export`

## Table

`binder_exports`
