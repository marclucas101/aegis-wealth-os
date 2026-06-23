$ErrorActionPreference = "Stop"

$steps = @(
    "1. Adviser generation - generate a meeting pack for an assigned client."
    "2. PDF inspection - review layout, pagination, and privacy."
    "3. Adviser download - confirm the assigned adviser can download it."
    "4. Idempotent reuse - repeat the same request and confirm reuse."
    "5. Regeneration - change the meeting date or sections and confirm a new version."
    "6. Adviser access denial - confirm an unassigned adviser is rejected."
    "7. Publication enablement - enable binder_client_publication manually only after adviser tests pass."
    "8. Client publication - publish the ready binder."
    "9. Client vault visibility - confirm it appears only for the correct client."
    "10. Client download - confirm the client can obtain a short-lived signed URL."
    "11. Supersession - publish a newer version in the same lineage."
    "12. Withdrawal - withdraw the current published version."
    "13. Stale access denial - confirm withdrawn and superseded versions cannot receive new client URLs."
    "14. Cross-client denial - test forged and mismatched client or binder IDs."
    "15. Notification enablement - enable document_event_notifications last."
    "16. Lifecycle notifications - verify available, superseded, and withdrawn events."
    "17. Download audit - confirm downloads are audit-only and do not create client notifications."
)

Write-Host ""
Write-Host "Phase 9F.3 Post-Deployment Checklist"
Write-Host "===================================="
Write-Host ""

foreach ($step in $steps) {
    Write-Host "[ ] $step"
}

Write-Host ""
Write-Host "Record results in:"
Write-Host "  docs/PHASE_9F3_FINAL_MANUAL_ACCEPTANCE_TESTS.md"
Write-Host "  docs/PHASE_9F3_RELEASE_SIGNOFF.md"
Write-Host ""
Write-Host "This script does not change feature controls or remote data."
