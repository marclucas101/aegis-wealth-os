# Phase 9F.3 schema verification helper (read-only — no remote DDL)
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot

$MainDiagnostic = "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql"
$DiscrepancyDiagnostic = "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql"

Write-Host "=== Phase 9F.3 schema verification (read-only) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Main diagnostic (expect EXACT_MATCH: 65 present, 0 absent, 0 conflicting, 0 unknown):"
Write-Host "  $MainDiagnostic"
Write-Host ""
Write-Host "Discrepancy diagnostic (expect zero rows):"
Write-Host "  $DiscrepancyDiagnostic"
Write-Host ""
Write-Host "SQL Editor execution is READ-ONLY. Do not run DDL from these files." -ForegroundColor Yellow
Write-Host ""

Write-Host "--- Migration list ---" -ForegroundColor Cyan
npx supabase migration list
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "--- db push dry-run (no remote DDL) ---" -ForegroundColor Cyan
npx supabase db push --dry-run
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Apply diagnostics manually in Supabase SQL Editor only." -ForegroundColor Green
