import { runCalendarUnitValidations } from "../src/lib/calendar/calendarValidation";

const result = runCalendarUnitValidations();
console.log(
  `Calendar unit validations passed (${result.passed} assertion groups).`,
);
