import {
  runBirthdayReminderAccessValidations,
  runBirthdayReminderLifecycleValidations,
  runBirthdayReminderUnitValidations,
} from "../src/lib/advisor/birthdayCalculationValidation";

const unit = runBirthdayReminderUnitValidations();
const lifecycle = runBirthdayReminderLifecycleValidations();
const access = runBirthdayReminderAccessValidations();

console.log(
  `Birthday reminder validations passed (${unit.passed + lifecycle.passed + access.passed} assertion groups).`,
);
