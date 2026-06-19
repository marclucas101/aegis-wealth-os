# Phase 9D — Manual Acceptance Tests

## Navigation

- [ ] Active client sees 8-item portal nav (Overview → Insights)
- [ ] Prospect sees prospect nav only (no My Plan / Goals & Reviews)
- [ ] Inactive client sees My Adviser + Documents only
- [ ] Adviser sees full Advisory section unchanged

## Financial Overview

- [ ] Published `financial_overview` displays readiness band (not AAA/AA)
- [ ] No publication shows adviser-preparing message (no raw scores)
- [ ] Stale overview shows Review recommended + booking CTA
- [ ] Portal shell shows adviser, appointment, task, plan status

## My Plan

- [ ] Only `client_published` + `published` outputs appear
- [ ] Draft/withdrawn/superseded outputs hidden
- [ ] Multiple outputs shown in hierarchy with dates

## Roadmap

- [ ] Client tasks and adviser status tasks separated
- [ ] Internal roadmap items (`client_visible=false`) hidden
- [ ] Task completion shows non-advice disclaimer

## Budget

- [ ] Save/load works for assigned client
- [ ] Surplus guidance mentions adviser discussion (no product rec)

## Goals & Reviews

- [ ] Add goal persists
- [ ] Review submission creates one adviser task
- [ ] Repeat submission is idempotent (pending message)
- [ ] Published review summaries visible when present

## Documents

- [ ] Client sees only visible documents
- [ ] Signed URL fails for internal documents

## Meeting summaries

- [ ] No client Meeting Studio API
- [ ] Published `meeting_summary` visible when flag enabled
- [ ] Hidden when `meeting_summary_publication` disabled

## Security

- [ ] Client APIs reject browser-supplied `client_id`
- [ ] Responses include `Cache-Control: private, no-store`
- [ ] Audit events contain event types only (no raw values)

## Responsive

- [ ] Mobile nav usable
- [ ] Portal shell grid readable on small screens
- [ ] Keyboard focus visible on forms
