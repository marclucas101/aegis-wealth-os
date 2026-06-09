# scoring-engine.md
# AEGIS WEALTH OPERATING SYSTEM™
## Institutional Scoring Engine Specification

---

## 1. Purpose

This document defines the scoring logic for the **AEGIS Wealth Operating System™**.

The scoring engine powers:

- AEGIS Shield Score™
- AEGIS Wealth Readiness Index™
- Discover Score™
- Data Confidence Factor™
- Pillar Scores
- Stress Test Scores
- Benchmark Scores
- Roadmap Impact Scores
- Family Office Mode Unlock Logic

The engine must be:

- Mathematical
- Explainable
- Modular
- Auditable
- Implementation-ready
- Suitable for Next.js, TypeScript, Supabase, and PostgreSQL

---

## 2. Core Scoring Principles

The platform does not score product ownership.

It scores financial architecture strength.

A high score means the client has stronger:

- Liquidity
- Protection
- Growth capacity
- Efficiency
- Adaptability
- Retirement durability
- Legacy readiness
- Behavioural discipline
- Family governance
- Continuity planning

Every score must be explainable through:

```ts
score = weightedInputs * dataConfidence * benchmarkAdjustment
```

All final scores must be clamped:

```ts
score = clamp(score, 0, 100)
```

---

## 3. Primary Metrics

### 3.1 AEGIS Shield Score™

The **Shield Score™** measures the strength of the client’s financial architecture.

Range:

```txt
0–100
```

Formula:

```ts
ShieldScore =
  FoundationScore * 0.30 +
  ProtectScore * 0.15 +
  GrowScore * 0.15 +
  OptimiseScore * 0.10 +
  TransitionScore * 0.10 +
  PreserveScore * 0.10 +
  LegacyScore * 0.10
```

Total weight:

```txt
100%
```

---

### 3.2 Adjusted Shield Score™

The **Adjusted Shield Score™** applies the Data Confidence Factor.

Formula:

```ts
AdjustedShieldScore = RawShieldScore * DataConfidenceFactor
```

Example:

```ts
RawShieldScore = 82
DataConfidenceFactor = 0.90
AdjustedShieldScore = 82 * 0.90 = 73.8
```

Use the adjusted score for:

- Dashboard display
- Client-facing score
- Reports
- Benchmark comparison
- Family Office Mode eligibility

Use the raw score for:

- Internal analytics
- Advisor review
- Data completeness analysis

---

## 4. Shield Pillar Weights

| Pillar | Weight | Purpose |
|---|---:|---|
| Core Foundation | 30% | Basic survivability |
| Protect | 15% | Catastrophe defence |
| Grow | 15% | Wealth creation |
| Optimise | 10% | Leakage reduction |
| Transition | 10% | Life-stage adaptability |
| Preserve | 10% | Retirement durability |
| Legacy | 10% | Wealth transfer readiness |

---

## 5. Pillar Sub-Factor Scoring

Each pillar is scored from `0–100`.

Each sub-factor is also scored from `0–100`.

Formula:

```ts
PillarScore = Σ(SubFactorScore * SubFactorWeight)
```

---

## 6. Core Foundation Score

Purpose:

Measure whether the client can survive financial disruption.

Weight in Shield Score:

```txt
30%
```

### Sub-Factors

| Sub-Factor | Weight |
|---|---:|
| Emergency Fund Adequacy | 25% |
| Hospitalisation Coverage | 20% |
| Income Stability | 15% |
| Savings Buffer | 15% |
| Debt Protection | 15% |
| Liquidity Access | 10% |

Formula:

```ts
FoundationScore =
  EmergencyFundScore * 0.25 +
  HospitalisationScore * 0.20 +
  IncomeStabilityScore * 0.15 +
  SavingsBufferScore * 0.15 +
  DebtProtectionScore * 0.15 +
  LiquidityAccessScore * 0.10
```

### Emergency Fund Score

Based on months of essential expenses covered.

| Months Covered | Score |
|---:|---:|
| 0 | 0 |
| 1 | 20 |
| 2 | 40 |
| 3 | 60 |
| 6 | 85 |
| 9+ | 100 |

Formula:

```ts
EmergencyFundMonths = LiquidEmergencyAssets / MonthlyEssentialExpenses
EmergencyFundScore = clamp(EmergencyFundMonths / 9 * 100, 0, 100)
```

### Hospitalisation Coverage Score

| Coverage Status | Score |
|---|---:|
| No coverage | 0 |
| Basic public coverage only | 40 |
| Integrated Shield Plan without rider | 70 |
| Integrated Shield Plan with rider | 90 |
| Comprehensive coverage reviewed within 12 months | 100 |

### Income Stability Score

| Income Profile | Score |
|---|---:|
| Unemployed / unstable | 20 |
| Single variable income | 45 |
| Stable employment | 70 |
| Stable employment + side income | 85 |
| Multiple reliable income streams | 100 |

### Savings Buffer Score

Formula:

```ts
SavingsRate = MonthlySurplus / MonthlyIncome
SavingsBufferScore = clamp(SavingsRate / 0.30 * 100, 0, 100)
```

### Debt Protection Score

Formula:

```ts
DebtProtectionRatio = ProtectedDebtAmount / TotalDebt
DebtProtectionScore = DebtProtectionRatio * 100
```

If client has no debt:

```ts
DebtProtectionScore = 100
```

### Liquidity Access Score

| Liquidity Position | Score |
|---|---:|
| No accessible liquidity | 0 |
| Limited liquidity | 40 |
| 1–3 months liquidity | 60 |
| 3–6 months liquidity | 80 |
| 6+ months liquidity | 100 |

---

## 7. Protect Score

Purpose:

Measure whether the family survives catastrophe.

Weight in Shield Score:

```txt
15%
```

### Sub-Factors

| Sub-Factor | Weight |
|---|---:|
| Life Coverage Adequacy | 25% |
| Critical Illness Coverage | 20% |
| Disability Income Coverage | 20% |
| Family Income Continuity | 15% |
| Estate Liquidity | 10% |
| Business Continuity Protection | 10% |

Formula:

```ts
ProtectScore =
  LifeCoverageScore * 0.25 +
  CriticalIllnessScore * 0.20 +
  DisabilityIncomeScore * 0.20 +
  FamilyIncomeContinuityScore * 0.15 +
  EstateLiquidityScore * 0.10 +
  BusinessContinuityScore * 0.10
```

### Life Coverage Adequacy

Formula:

```ts
RequiredLifeCoverage =
  OutstandingDebt +
  DependantsAnnualExpense * YearsOfSupportRequired +
  EducationFundingNeeds +
  FinalExpenses -
  ExistingLiquidAssets

LifeCoverageRatio = ExistingLifeCoverage / RequiredLifeCoverage
LifeCoverageScore = clamp(LifeCoverageRatio * 100, 0, 100)
```

If no dependants and no debt:

```ts
LifeCoverageScore = 80
```

If no dependants, no debt, and estate liquidity is adequate:

```ts
LifeCoverageScore = 100
```

### Critical Illness Coverage

Recommended baseline:

```ts
RequiredCICoverage = AnnualIncome * 3
```

Formula:

```ts
CIRatio = ExistingCICoverage / RequiredCICoverage
CriticalIllnessScore = clamp(CIRatio * 100, 0, 100)
```

### Disability Income Coverage

Recommended baseline:

```ts
RequiredDisabilityIncome = MonthlyIncome * 0.75
```

Formula:

```ts
DIRatio = MonthlyDisabilityIncomeBenefit / RequiredDisabilityIncome
DisabilityIncomeScore = clamp(DIRatio * 100, 0, 100)
```

### Family Income Continuity

Formula:

```ts
FamilyIncomeContinuityYears =
  AvailableFamilyContinuationCapital / AnnualFamilyExpenses

FamilyIncomeContinuityScore = clamp(FamilyIncomeContinuityYears / 10 * 100, 0, 100)
```

### Estate Liquidity Score

Formula:

```ts
EstateLiquidityNeed =
  EstimatedEstateCosts +
  TaxesOrFees +
  OutstandingLiabilities +
  ImmediateFamilyLiquidityNeeds

EstateLiquidityRatio = AvailableEstateLiquidity / EstateLiquidityNeed
EstateLiquidityScore = clamp(EstateLiquidityRatio * 100, 0, 100)
```

### Business Continuity Protection

If no business ownership:

```ts
BusinessContinuityScore = 100
```

If business owner:

| Planning Status | Score |
|---|---:|
| No continuity plan | 0 |
| Informal plan | 30 |
| Key person coverage only | 60 |
| Buy-sell agreement or succession plan | 80 |
| Formal funded succession structure | 100 |

---

## 8. Grow Score

Purpose:

Measure wealth creation capability.

Weight in Shield Score:

```txt
15%
```

### Sub-Factors

| Sub-Factor | Weight |
|---|---:|
| Savings Rate | 20% |
| Investment Rate | 20% |
| Asset Allocation Quality | 20% |
| Diversification | 15% |
| Retirement Funding Ratio | 15% |
| Risk Alignment | 10% |

Formula:

```ts
GrowScore =
  SavingsRateScore * 0.20 +
  InvestmentRateScore * 0.20 +
  AssetAllocationScore * 0.20 +
  DiversificationScore * 0.15 +
  RetirementFundingScore * 0.15 +
  RiskAlignmentScore * 0.10
```

### Savings Rate Score

```ts
SavingsRateScore = clamp(SavingsRate / TargetSavingsRate * 100, 0, 100)
```

Default target:

```ts
TargetSavingsRate = 0.25
```

### Investment Rate Score

```ts
InvestmentRate = MonthlyInvestmentContribution / MonthlyIncome
InvestmentRateScore = clamp(InvestmentRate / TargetInvestmentRate * 100, 0, 100)
```

Default target:

```ts
TargetInvestmentRate = 0.20
```

### Asset Allocation Score

| Allocation Quality | Score |
|---|---:|
| No clear allocation | 0 |
| Mostly cash / concentrated assets | 30 |
| Basic allocation | 60 |
| Diversified multi-asset allocation | 80 |
| Goals-based strategic allocation | 100 |

### Diversification Score

```ts
DiversificationScore =
  AssetClassDiversification * 0.50 +
  GeographicDiversification * 0.25 +
  SectorDiversification * 0.25
```

### Retirement Funding Ratio

```ts
RetirementFundingRatio =
  ProjectedRetirementAssets / RequiredRetirementAssets

RetirementFundingScore = clamp(RetirementFundingRatio * 100, 0, 100)
```

### Risk Alignment Score

| Alignment | Score |
|---|---:|
| Severe mismatch | 20 |
| Moderate mismatch | 50 |
| Acceptable alignment | 75 |
| Strong alignment | 90 |
| Documented IPS-level alignment | 100 |

---

## 9. Optimise Score

Purpose:

Measure financial leakage and efficiency.

Weight in Shield Score:

```txt
10%
```

### Sub-Factors

| Sub-Factor | Weight |
|---|---:|
| Debt Cost Efficiency | 20% |
| Tax Efficiency | 20% |
| Premium Efficiency | 20% |
| Cash Drag | 15% |
| Investment Cost Efficiency | 15% |
| Policy Duplication | 10% |

Formula:

```ts
OptimiseScore =
  DebtCostEfficiencyScore * 0.20 +
  TaxEfficiencyScore * 0.20 +
  PremiumEfficiencyScore * 0.20 +
  CashDragScore * 0.15 +
  InvestmentCostEfficiencyScore * 0.15 +
  PolicyDuplicationScore * 0.10
```

### Debt Cost Efficiency

```ts
DebtCostEfficiencyScore = 100 - clamp(HighInterestDebtRatio * 100, 0, 100)
```

If no debt:

```ts
DebtCostEfficiencyScore = 100
```

### Tax Efficiency Score

| Status | Score |
|---|---:|
| No tax planning | 40 |
| Basic tax awareness | 60 |
| Uses available deductions/reliefs | 75 |
| Structured tax-efficient planning | 90 |
| Advanced tax and estate coordination | 100 |

### Premium Efficiency Score

```ts
PremiumLoadRatio = AnnualInsurancePremiums / AnnualIncome
```

| Premium Load | Score |
|---:|---:|
| 0% with protection gaps | 30 |
| 1–10% | 100 |
| 10–15% | 80 |
| 15–20% | 60 |
| 20%+ | 40 |

### Cash Drag Score

```ts
ExcessCash = max(0, CashAssets - TargetLiquidityReserve)
CashDragRatio = ExcessCash / TotalInvestableAssets
CashDragScore = 100 - clamp(CashDragRatio / 0.50 * 100, 0, 100)
```

### Investment Cost Efficiency

| Average Cost Level | Score |
|---|---:|
| Unknown | 40 |
| High-cost portfolio | 50 |
| Moderate-cost portfolio | 70 |
| Low-cost diversified portfolio | 90 |
| Institutionally efficient portfolio | 100 |

### Policy Duplication Score

| Duplication Level | Score |
|---|---:|
| Significant duplication | 30 |
| Moderate duplication | 60 |
| Minor duplication | 80 |
| No duplication | 100 |

---

## 10. Transition Score

Purpose:

Measure readiness for major life changes.

Weight in Shield Score:

```txt
10%
```

### Sub-Factors

| Sub-Factor | Weight |
|---|---:|
| Marriage / Partnership Readiness | 10% |
| Children Planning | 15% |
| Property Purchase Readiness | 15% |
| Parent Care Readiness | 20% |
| Career Change Readiness | 15% |
| Business Exit Readiness | 15% |
| Retirement Transition Readiness | 10% |

Formula:

```ts
TransitionScore =
  MarriageReadinessScore * 0.10 +
  ChildrenPlanningScore * 0.15 +
  PropertyReadinessScore * 0.15 +
  ParentCareReadinessScore * 0.20 +
  CareerChangeReadinessScore * 0.15 +
  BusinessExitReadinessScore * 0.15 +
  RetirementTransitionScore * 0.10
```

If a category is not applicable, reallocate its weight proportionally across applicable categories.

---

## 11. Preserve Score

Purpose:

Measure whether wealth can survive time.

Weight in Shield Score:

```txt
10%
```

### Sub-Factors

| Sub-Factor | Weight |
|---|---:|
| Retirement Sustainability | 25% |
| Inflation Protection | 15% |
| Healthcare Funding | 20% |
| Longevity Buffer | 15% |
| Drawdown Strategy | 15% |
| Asset Protection | 10% |

Formula:

```ts
PreserveScore =
  RetirementSustainabilityScore * 0.25 +
  InflationProtectionScore * 0.15 +
  HealthcareFundingScore * 0.20 +
  LongevityBufferScore * 0.15 +
  DrawdownStrategyScore * 0.15 +
  AssetProtectionScore * 0.10
```

### Retirement Sustainability

```ts
RetirementSustainabilityRatio =
  ProjectedRetirementIncome / RequiredRetirementIncome

RetirementSustainabilityScore =
  clamp(RetirementSustainabilityRatio * 100, 0, 100)
```

### Inflation Protection

| Status | Score |
|---|---:|
| No inflation protection | 20 |
| Mostly fixed cash assets | 40 |
| Some growth assets | 65 |
| Balanced inflation-aware allocation | 85 |
| Strong inflation-linked planning | 100 |

### Healthcare Funding

| Status | Score |
|---|---:|
| No plan | 20 |
| Basic coverage | 50 |
| Good hospitalisation coverage | 75 |
| Healthcare reserve included | 90 |
| Long-term care and healthcare reserve included | 100 |

### Longevity Buffer

```ts
LongevityBufferYears =
  ProjectedAssetsLastUntilAge - TargetPlanningAge

LongevityBufferScore = clamp((LongevityBufferYears + 5) / 20 * 100, 0, 100)
```

Default target planning age:

```ts
95
```

### Drawdown Strategy

| Status | Score |
|---|---:|
| No drawdown plan | 20 |
| Basic withdrawal estimate | 50 |
| Sustainable withdrawal plan | 75 |
| Dynamic drawdown strategy | 90 |
| Tax-aware multi-bucket strategy | 100 |

### Asset Protection

| Status | Score |
|---|---:|
| No asset protection | 30 |
| Basic beneficiary planning | 50 |
| Insurance and estate coordination | 75 |
| Trust / holding structure considered | 90 |
| Formal asset protection structure | 100 |

---

## 12. Legacy Score

Purpose:

Measure whether wealth can outlive the client.

Weight in Shield Score:

```txt
10%
```

### Sub-Factors

| Sub-Factor | Weight |
|---|---:|
| Will Completion | 15% |
| CPF Nomination | 10% |
| Insurance Nomination | 10% |
| Beneficiary Clarity | 10% |
| Trust Planning | 15% |
| Business Succession | 15% |
| Family Governance | 15% |
| Estate Liquidity | 10% |

Formula:

```ts
LegacyScore =
  WillScore * 0.15 +
  CPFNominationScore * 0.10 +
  InsuranceNominationScore * 0.10 +
  BeneficiaryClarityScore * 0.10 +
  TrustPlanningScore * 0.15 +
  BusinessSuccessionScore * 0.15 +
  FamilyGovernanceScore * 0.15 +
  EstateLiquidityScore * 0.10
```

If business succession is not applicable, reallocate its weight proportionally.

---

## 13. Discover Score™

Purpose:

Measure completeness of client data.

Range:

```txt
0–100
```

### Data Categories

| Category | Weight |
|---|---:|
| Personal Information | 5% |
| Family Information | 10% |
| Income | 10% |
| Expenses | 10% |
| Assets | 10% |
| Liabilities | 10% |
| Policies | 10% |
| Investments | 10% |
| Retirement Goals | 10% |
| Estate Information | 10% |
| Business / Governance | 5% |

Formula:

```ts
DiscoverScore =
  PersonalInfoCompleteness * 0.05 +
  FamilyInfoCompleteness * 0.10 +
  IncomeCompleteness * 0.10 +
  ExpensesCompleteness * 0.10 +
  AssetsCompleteness * 0.10 +
  LiabilitiesCompleteness * 0.10 +
  PoliciesCompleteness * 0.10 +
  InvestmentsCompleteness * 0.10 +
  RetirementGoalsCompleteness * 0.10 +
  EstateCompleteness * 0.10 +
  BusinessGovernanceCompleteness * 0.05
```

---

## 14. Data Confidence Factor™

Purpose:

Adjust scores based on data reliability.

Range:

```txt
0.70–1.00
```

Formula:

```ts
DataConfidenceFactor = 0.70 + (DiscoverScore / 100) * 0.30
```

Examples:

| Discover Score | Data Confidence Factor |
|---:|---:|
| 0 | 0.70 |
| 50 | 0.85 |
| 75 | 0.925 |
| 100 | 1.00 |

Use:

```ts
AdjustedShieldScore = RawShieldScore * DataConfidenceFactor
```

---

## 15. AEGIS Wealth Readiness Index™ Calculation

The **AWRI™** measures overall readiness.

Formula:

```ts
AWRI =
  AdjustedShieldScore * 0.50 +
  ResilienceScore * 0.20 +
  BehaviourScore * 0.10 +
  GovernanceScore * 0.10 +
  ContinuityScore * 0.10
```

### Resilience Score

Purpose:

Measure shock absorption.

| Sub-Factor | Weight |
|---|---:|
| Liquidity | 25% |
| Income Diversity | 15% |
| Asset Diversity | 15% |
| Emergency Funding | 20% |
| Insurance Adequacy | 15% |
| Debt Burden | 10% |

Formula:

```ts
ResilienceScore =
  LiquidityScore * 0.25 +
  IncomeDiversityScore * 0.15 +
  AssetDiversityScore * 0.15 +
  EmergencyFundingScore * 0.20 +
  InsuranceAdequacyScore * 0.15 +
  DebtBurdenScore * 0.10
```

### Behaviour Score

Purpose:

Measure execution quality.

| Sub-Factor | Weight |
|---|---:|
| Spending Discipline | 25% |
| Investment Discipline | 20% |
| Goal Consistency | 20% |
| Emergency Preparedness | 15% |
| Emotional Decision-Making | 10% |
| Financial Confidence | 10% |

### Governance Score

Purpose:

Measure family decision-making readiness.

| Sub-Factor | Weight |
|---|---:|
| Family Meetings | 15% |
| Successor Readiness | 20% |
| Financial Education | 20% |
| Decision-Making Structure | 20% |
| Family Constitution | 15% |
| Governance Practices | 10% |

### Continuity Score

Purpose:

Measure generational sustainability.

| Sub-Factor | Weight |
|---|---:|
| Legacy Planning | 25% |
| Succession Planning | 20% |
| Family Governance | 20% |
| Trust Structures | 15% |
| Estate Liquidity | 10% |
| Education Legacy | 10% |

---

## 16. Rating Thresholds

| Score | Rating | Meaning |
|---:|---|---|
| 95–100 | AAA | Exceptional shield strength |
| 85–94 | AA | Very strong architecture |
| 75–84 | A | Strong but improvable |
| 60–74 | BBB | Functional but exposed |
| 40–59 | BB | Material gaps present |
| 0–39 | B | Significant vulnerability |

TypeScript:

```ts
function getRating(score: number): ShieldRating {
  if (score >= 95) return "AAA";
  if (score >= 85) return "AA";
  if (score >= 75) return "A";
  if (score >= 60) return "BBB";
  if (score >= 40) return "BB";
  return "B";
}
```

---

## 17. Stress Test Impact Logic

Purpose:

Measure how the shield behaves under financial shocks.

Formula:

```ts
PostStressShieldScore = AdjustedShieldScore - StressImpactPenalty + MitigationCredit
PostStressShieldScore = clamp(PostStressShieldScore, 0, 100)
```

### Stress Impact Penalty

Each stress event affects different pillars.

| Stress Event | Foundation | Protect | Grow | Optimise | Transition | Preserve | Legacy |
|---|---:|---:|---:|---:|---:|---:|---:|
| Income Loss | 35% | 10% | 20% | 10% | 15% | 10% | 0% |
| Critical Illness | 20% | 35% | 5% | 5% | 10% | 15% | 10% |
| Death Event | 10% | 40% | 0% | 5% | 10% | 10% | 25% |
| Disability | 25% | 35% | 5% | 5% | 10% | 15% | 5% |
| Market Crash | 10% | 0% | 45% | 15% | 5% | 25% | 0% |
| Inflation Shock | 10% | 0% | 20% | 20% | 5% | 40% | 5% |
| Longevity | 5% | 0% | 15% | 10% | 10% | 55% | 5% |
| Business Failure | 25% | 15% | 20% | 10% | 20% | 5% | 5% |
| Parent Care | 25% | 5% | 10% | 10% | 35% | 15% | 0% |
| Estate Delay | 5% | 10% | 0% | 5% | 10% | 20% | 50% |

### Stress Severity

| Severity | Penalty Multiplier |
|---|---:|
| Mild | 0.50 |
| Moderate | 1.00 |
| Severe | 1.50 |
| Extreme | 2.00 |

### Pillar Vulnerability Penalty

Formula:

```ts
PillarVulnerability = 100 - PillarScore

StressPenalty =
  Σ(PillarVulnerability * StressEventWeight * SeverityMultiplier * 0.30)
```

The `0.30` factor prevents excessive score collapse.

### Mitigation Credit

| Safeguard | Credit |
|---|---:|
| Emergency fund ≥ 6 months | +3 |
| CI coverage ≥ 3x annual income | +4 |
| Disability income coverage | +4 |
| Valid will | +3 |
| Diversified portfolio | +3 |
| Healthcare funding reserve | +3 |
| Business succession plan | +5 |
| Estate liquidity plan | +4 |

Maximum mitigation credit:

```ts
15
```

Formula:

```ts
MitigationCredit = min(totalCredits, 15)
```

---

## 18. Benchmark Logic

Purpose:

Compare the client against relevant cohorts.

### Cohort Selection

Determine benchmark cohort using:

- Age
- Income
- Marital status
- Dependants
- Net worth
- Occupation
- Business ownership
- Retirement status
- Family complexity

Priority logic:

```ts
if (isBusinessOwner) cohort = "Business Owner";
else if (netWorth >= familyOfficeThreshold) cohort = "Family Office Candidate";
else if (age >= 60) cohort = "Retiree";
else if (age >= 50) cohort = "Pre-Retiree";
else if (hasChildren) cohort = "Young Family";
else if (occupation === "Medical Professional") cohort = "Medical Professional";
else if (income >= executiveIncomeThreshold) cohort = "Executive";
else if (married || hasPartner) cohort = "Dual-Income Couple";
else cohort = "Young Professional";
```

### Benchmark Table

Initial benchmark values may be seeded manually.

| Cohort | Average | Top 25% | Top 10% |
|---|---:|---:|---:|
| Young Professional | 55 | 68 | 78 |
| Dual-Income Couple | 60 | 72 | 82 |
| Young Family | 58 | 70 | 80 |
| Executive | 68 | 80 | 90 |
| Business Owner | 66 | 82 | 91 |
| Medical Professional | 70 | 82 | 92 |
| Affluent Family | 75 | 86 | 94 |
| Pre-Retiree | 70 | 82 | 90 |
| Retiree | 72 | 84 | 92 |
| Family Office Candidate | 82 | 92 | 97 |

### Benchmark Position

```ts
BenchmarkDelta = AdjustedShieldScore - CohortAverage
```

| Delta | Classification |
|---:|---|
| +15 or more | Leading |
| +5 to +14 | Above Average |
| -4 to +4 | In Line |
| -5 to -14 | Below Average |
| -15 or lower | Materially Behind |

---

## 19. Roadmap Score Improvement Logic

Purpose:

Estimate score improvement from completed actions.

Each roadmap item has:

```ts
{
  pillar: ShieldPillar;
  impact: number;
  difficulty: "Low" | "Medium" | "High";
  priority: "Low" | "Medium" | "High" | "Critical";
  timelineMonths: number;
  status: "Not Started" | "In Progress" | "Completed";
}
```

### Impact Rules

Impact must be capped to avoid unrealistic score inflation.

| Action Type | Typical Impact |
|---|---:|
| Data completion | +1 to +5 |
| Emergency fund improvement | +3 to +10 |
| Hospitalisation review | +2 to +6 |
| CI gap closure | +3 to +10 |
| Disability protection | +3 to +8 |
| Debt restructuring | +2 to +8 |
| Retirement contribution increase | +3 to +10 |
| Portfolio diversification | +2 to +8 |
| Will completion | +5 to +10 |
| CPF / insurance nomination | +3 to +6 |
| Trust planning | +5 to +12 |
| Business succession plan | +8 to +15 |
| Family governance structure | +5 to +12 |

### Projected Pillar Score

```ts
ProjectedPillarScore =
  clamp(CurrentPillarScore + Σ(CompletedAndPlannedImpacts), 0, 100)
```

### Projected Shield Score

```ts
ProjectedShieldScore =
  ProjectedFoundationScore * 0.30 +
  ProjectedProtectScore * 0.15 +
  ProjectedGrowScore * 0.15 +
  ProjectedOptimiseScore * 0.10 +
  ProjectedTransitionScore * 0.10 +
  ProjectedPreserveScore * 0.10 +
  ProjectedLegacyScore * 0.10
```

Then apply confidence:

```ts
ProjectedAdjustedShieldScore =
  ProjectedShieldScore * DataConfidenceFactor
```

### Priority Score

Formula:

```ts
PriorityScore =
  GapSeverity * 0.40 +
  StressExposure * 0.30 +
  ImpactPotential * 0.20 +
  Urgency * 0.10
```

| Priority Score | Priority |
|---:|---|
| 80–100 | Critical |
| 60–79 | High |
| 40–59 | Medium |
| 0–39 | Low |

---

## 20. Family Office Mode Unlock Logic

Family Office Mode unlocks when the client demonstrates advanced complexity and readiness.

### Required Conditions

```ts
AdjustedShieldScore >= 90
LegacyScore >= 80
GovernanceScore >= 80
ContinuityScore >= 80
NetWorth >= FamilyOfficeNetWorthThreshold
```

Default threshold:

```ts
FamilyOfficeNetWorthThreshold = 5000000
```

Currency should be configurable.

### Optional Complexity Conditions

At least one should be true:

```ts
hasBusinessOwnership === true
hasMultipleProperties === true
hasCrossBorderAssets === true
hasTrustStructure === true
hasMultiGenerationDependants === true
hasPhilanthropicGoals === true
```

### Unlock Formula

```ts
FamilyOfficeEligible =
  AdjustedShieldScore >= 90 &&
  LegacyScore >= 80 &&
  GovernanceScore >= 80 &&
  ContinuityScore >= 80 &&
  NetWorth >= FamilyOfficeNetWorthThreshold &&
  ComplexityConditionMet
```

### Family Office Readiness Score

```ts
FamilyOfficeReadinessScore =
  AdjustedShieldScore * 0.30 +
  LegacyScore * 0.20 +
  GovernanceScore * 0.20 +
  ContinuityScore * 0.20 +
  ComplexityScore * 0.10
```

---

## 21. TypeScript Implementation Types

```ts
export type ShieldPillar =
  | "foundation"
  | "protect"
  | "grow"
  | "optimise"
  | "transition"
  | "preserve"
  | "legacy";

export type ShieldRating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B";

export type StressSeverity = "mild" | "moderate" | "severe" | "extreme";

export type RoadmapPriority = "low" | "medium" | "high" | "critical";

export interface PillarScores {
  foundation: number;
  protect: number;
  grow: number;
  optimise: number;
  transition: number;
  preserve: number;
  legacy: number;
}

export interface ShieldScoreResult {
  rawShieldScore: number;
  adjustedShieldScore: number;
  dataConfidenceFactor: number;
  rating: ShieldRating;
  pillarScores: PillarScores;
}

export interface AWRIResult {
  awri: number;
  adjustedShieldScore: number;
  resilienceScore: number;
  behaviourScore: number;
  governanceScore: number;
  continuityScore: number;
}

export interface StressTestResult {
  scenario: string;
  severity: StressSeverity;
  preStressScore: number;
  postStressScore: number;
  stressPenalty: number;
  mitigationCredit: number;
  affectedPillars: Partial<PillarScores>;
}

export interface BenchmarkResult {
  cohort: string;
  clientScore: number;
  cohortAverage: number;
  top25: number;
  top10: number;
  benchmarkDelta: number;
  classification:
    | "Leading"
    | "Above Average"
    | "In Line"
    | "Below Average"
    | "Materially Behind";
}

export interface RoadmapItem {
  id: string;
  title: string;
  pillar: ShieldPillar;
  currentScore: number;
  targetScore: number;
  estimatedImpact: number;
  timelineMonths: number;
  difficulty: "low" | "medium" | "high";
  priority: RoadmapPriority;
  status: "not_started" | "in_progress" | "completed";
}
```

---

## 22. Core Utility Functions

```ts
export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
```

```ts
export function calculateRawShieldScore(scores: PillarScores): number {
  return (
    scores.foundation * 0.30 +
    scores.protect * 0.15 +
    scores.grow * 0.15 +
    scores.optimise * 0.10 +
    scores.transition * 0.10 +
    scores.preserve * 0.10 +
    scores.legacy * 0.10
  );
}
```

```ts
export function calculateDataConfidenceFactor(discoverScore: number): number {
  return 0.70 + (clamp(discoverScore) / 100) * 0.30;
}
```

```ts
export function calculateAdjustedShieldScore(
  rawShieldScore: number,
  dataConfidenceFactor: number
): number {
  return clamp(rawShieldScore * dataConfidenceFactor);
}
```

```ts
export function calculateAWRI(params: {
  adjustedShieldScore: number;
  resilienceScore: number;
  behaviourScore: number;
  governanceScore: number;
  continuityScore: number;
}): number {
  return clamp(
    params.adjustedShieldScore * 0.50 +
    params.resilienceScore * 0.20 +
    params.behaviourScore * 0.10 +
    params.governanceScore * 0.10 +
    params.continuityScore * 0.10
  );
}
```

---

## 23. Supabase / PostgreSQL Implementation Notes

Recommended tables:

```txt
clients
client_profiles
financial_profiles
pillar_scores
shield_scores
discover_scores
stress_tests
benchmarks
roadmap_items
annual_reviews
documents
family_office_assessments
```

### shield_scores Table

```sql
create table shield_scores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  raw_shield_score numeric not null,
  adjusted_shield_score numeric not null,
  data_confidence_factor numeric not null,
  rating text not null,
  foundation_score numeric not null,
  protect_score numeric not null,
  grow_score numeric not null,
  optimise_score numeric not null,
  transition_score numeric not null,
  preserve_score numeric not null,
  legacy_score numeric not null,
  calculated_at timestamptz default now()
);
```

### roadmap_items Table

```sql
create table roadmap_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  pillar text not null,
  current_score numeric not null,
  target_score numeric not null,
  estimated_impact numeric not null,
  timeline_months integer not null,
  difficulty text not null,
  priority text not null,
  status text not null default 'not_started',
  created_at timestamptz default now(),
  completed_at timestamptz
);
```

### stress_tests Table

```sql
create table stress_tests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  scenario text not null,
  severity text not null,
  pre_stress_score numeric not null,
  post_stress_score numeric not null,
  stress_penalty numeric not null,
  mitigation_credit numeric not null,
  created_at timestamptz default now()
);
```

---

## 24. Client-Facing Interpretation Rules

Scores must never be presented as judgement.

Use language such as:

- “Your shield is currently functional, with several areas that can be strengthened.”
- “Your strongest pillar is Preserve.”
- “Your largest architectural gap is Legacy.”
- “Improving your emergency reserve may increase your Foundation score by approximately 8 points.”
- “Your current architecture appears resilient against moderate income disruption, but less prepared for disability or estate transfer delay.”

Avoid:

- “You are underinsured.”
- “You are financially weak.”
- “You need to buy.”
- “You are behind.”
- “You are at risk unless you act now.”

---

## 25. Final Scoring Standard

The AEGIS scoring engine must always answer:

1. How strong is the client’s shield today?
2. What are the weakest architectural pillars?
3. What happens under stress?
4. How does the client compare to peers?
5. What actions create the largest improvement?
6. Is the family prepared for continuity?
7. Is the client ready for Family Office Mode?

The score is not the product.

The score is the operating signal.

Every calculation must strengthen the shield.
