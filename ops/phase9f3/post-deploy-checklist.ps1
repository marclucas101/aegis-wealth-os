# Phase 9F.3 post-deploy human acceptance sequence (no remote mutation)
$ErrorActionPreference = "Continue"

Write-Host "=== Phase 9F.3 post-deploy manual acceptance sequence ===" -ForegroundColor Cyan
Write-Host "Execute in order. Do not enable notifications until step 15." -ForegroundColor Yellow
Write-Host ""

$steps = @(
    "1. Adviser generation — generate meeting pack for assigned client with binder_export enabled",
    "2. PDF inspection — open generated PDF; verify privacy (no NRIC, accounts, internal notes)",
    "3. Adviser download — download via signed URL; confirm no storage path in API JSON",
    "4. Idempotent reuse — repeat identical generation; confirm reused: true",
    "5. Regeneration — change sections; confirm new version in same lineage",
    "6. Unassigned adviser denial — unassigned adviser cannot generate",
    "7. Enable publication manually — enable binder_client_publication in platform_feature_controls",
    "8. Publish — publish with explicit confirm; verify document row linked",
    "9. Client vault visibility — client sees meeting pack in document vault",
    "10. Client download — client downloads PDF; signed URL expires; no path in response",
    "11. Same-lineage supersession — publish v2; v1 unavailable; v2 current",
    "12. Withdrawal — adviser withdraws with allowlisted reason; client loses access",
    "13. Stale access denial — open old notification; safe no longer available state",
    "14. Cross-client denial — client A cannot access client B binder/document",
    "15. Enable notifications last — enable document_event_notifications",
    "16. Verify available/superseded/withdrawn lifecycle notifications",
    "17. Verify downloaded remains audit-only — no signed URL or storage path in audit metadata"
)

foreach ($step in $steps) {
    Write-Host "  [ ] $step"
}

Write-Host ""
Write-Host "Full detail: docs/PHASE_9F3_FINAL_MANUAL_ACCEPTANCE_TESTS.md" -ForegroundColor Cyan
Write-Host "Sign-off: docs/PHASE_9F3_RELEASE_SIGNOFF.md" -ForegroundColor Cyan
