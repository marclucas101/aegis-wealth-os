import { analyzeBudget } from "./analyzeBudget";
import {
  calculateSavingsRate,
  calculateTotalMonthlyExpense,
  classifySpendingStatus,
} from "./calculations";
import { getBenchmarksForArchetype } from "./budgetBenchmarks";
import { draftToClientProfile } from "./formState";
import {
  sampleStudentDraft,
  sampleWorkingAdultWithCarDraft,
} from "./sampleData";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Budget optimiser validation failed: ${message}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, label: string): void {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

export function runBudgetOptimiserValidations(): {
  passed: number;
  studentTransportStatus: string;
  carAdultTransportStatus: string;
} {
  let passed = 0;

  const studentProfile = draftToClientProfile(sampleStudentDraft);
  const studentTotal = calculateTotalMonthlyExpense(studentProfile.entries);
  assert(studentTotal > 0, "student total monthly expense should be positive");
  const expectedStudentTotal = Object.values(sampleStudentDraft.amounts).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );
  assertApprox(studentTotal, expectedStudentTotal, 0, "student sample total");
  passed += 1;

  const studentBenchmark = getBenchmarksForArchetype("student").transport;
  const studentTransportStatus = classifySpendingStatus(300, studentBenchmark);
  assert(studentTransportStatus === "overspending", "student $300 transport should overspend");
  passed += 1;

  const carProfile = draftToClientProfile(sampleWorkingAdultWithCarDraft);
  const carBenchmark = getBenchmarksForArchetype("working_adult_with_car").transport;
  const carTransportStatus = classifySpendingStatus(300, carBenchmark);
  assert(
    carTransportStatus === "within_range",
    "working adult with car $300 transport should be within range"
  );
  passed += 1;

  const income = 8500;
  const carTotal = calculateTotalMonthlyExpense(carProfile.entries);
  const savingsRate = calculateSavingsRate(carTotal, income);
  assert(savingsRate > 0 && savingsRate < 1, "savings rate should be between 0 and 1");
  passed += 1;

  const studentAnalysis = analyzeBudget(studentProfile);
  assert(
    studentAnalysis.overspendingCategories.some(
      (item) => item.category === "transport"
    ),
    "student analysis should flag transport overspending"
  );
  assert(studentAnalysis.topSpendingCategories.length <= 3, "top categories capped at 3");
  passed += 1;

  const carAnalysis = analyzeBudget(carProfile);
  const carTransportAnalysis = carAnalysis.categoryAnalyses.find(
    (item) => item.category === "transport"
  );
  assert(
    carTransportAnalysis?.status === "within_range",
    "car adult analysis transport should be within range"
  );
  passed += 1;

  return {
    passed,
    studentTransportStatus,
    carAdultTransportStatus: carTransportStatus,
  };
}
