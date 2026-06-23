# Phase 9F.3 local gate runner — stops on first failure
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot

function Invoke-Gate {
    param(
        [string]$Name,
        [string]$Command
    )
    Write-Host ""
    Write-Host ">>> $Name" -ForegroundColor Cyan
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $Name" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "PASSED: $Name" -ForegroundColor Green
}

Write-Host "=== Phase 9F.3 local gates ===" -ForegroundColor Cyan

Invoke-Gate "Phase 9F.3 index predicate validation" "npx tsx scripts/run-phase9f3-index-predicate-validation.ts"
Invoke-Gate "Phase 9F.3 binder client vault QA" "npm run qa:phase9f3-binder-client-vault"
Invoke-Gate "Phase 9F.3 local acceptance" "npm run qa:phase9f3-local-acceptance"
Invoke-Gate "A4 report QA" "npm run qa:a4-summary-report"
Invoke-Gate "Phase 9F.2 lifecycle notifications QA" "npm run qa:phase9f2-lifecycle-notifications"
Invoke-Gate "Phase 9F.1 scheduled publishing QA" "npm run qa:phase9f-scheduled-publishing"
Invoke-Gate "Phase 9E communications QA" "npm run qa:phase9e-communications"
Invoke-Gate "Migration readiness" "npm run qa:migration-readiness"
Invoke-Gate "Diagnostic SQL syntax" "npm run qa:diagnostic-sql-syntax"
Invoke-Gate "API security" "npm run security:api"
Invoke-Gate "Adviser access security" "npm run security:advisor-access"
Invoke-Gate "Service-role security" "npm run security:service-role"
Invoke-Gate "Final check" "npm run final:check"
Invoke-Gate "TypeScript" "npx tsc --noEmit"
Invoke-Gate "Lint" "npm run lint"
Invoke-Gate "Build" "npm run build"
Invoke-Gate "Supabase dry run" "npx supabase db push --dry-run"

Write-Host ""
Write-Host "All local gates passed." -ForegroundColor Green
