import { runProtectionCoreValidations } from "../src/lib/scoring/protectionCoreValidation";

const result = runProtectionCoreValidations();
console.log(
  `Protection core validations passed (${result.passed} assertion groups).`,
);
