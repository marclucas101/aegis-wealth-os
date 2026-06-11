import { runBudgetOptimiserValidations } from "../src/features/budget-optimiser/validationExamples";

const result = runBudgetOptimiserValidations();
console.log(`Budget optimiser validations passed (${result.passed} assertion groups).`);
console.log(
  JSON.stringify(
    {
      studentTransportStatus: result.studentTransportStatus,
      carAdultTransportStatus: result.carAdultTransportStatus,
    },
    null,
    2
  )
);
