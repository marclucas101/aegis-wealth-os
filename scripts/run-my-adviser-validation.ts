import { runMyAdviserUnitValidations } from "../src/lib/myAdviser/myAdviserValidation";

const result = runMyAdviserUnitValidations();
console.log(
  `My Adviser unit validations passed (${result.passed} assertion groups).`,
);
