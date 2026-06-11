import { runProtectionReportValidations } from "../src/features/advisor-console/protection-report/validationExamples";

const result = runProtectionReportValidations();
console.log(`Protection report validations passed (${result.passed} assertion groups).`);
console.log(JSON.stringify(result.summary, null, 2));
