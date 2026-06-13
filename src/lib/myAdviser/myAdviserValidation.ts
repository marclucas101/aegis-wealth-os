import { mapTestimonialRowForValidation } from "./testimonialMapping";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`My Adviser unit validation failed: ${message}`);
  }
}

export function runMyAdviserUnitValidations(): { passed: number } {
  let passed = 0;

  const anonymous = mapTestimonialRowForValidation({
    id: "1",
    rating_overall: 5,
    what_went_well: "Excellent guidance",
    feedback_text: "Private note",
    testimonial_display_name: "Jane Doe",
    testimonial_anonymous: true,
    created_at: "2026-01-01T00:00:00Z",
  });

  assert(anonymous?.displayLabel === "Verified client", "anonymous label");
  assert(
    anonymous?.testimonialText === "Excellent guidance",
    "uses what_went_well text",
  );
  passed += 1;

  const named = mapTestimonialRowForValidation({
    id: "2",
    rating_overall: 4,
    what_went_well: null,
    feedback_text: "Very responsive team",
    testimonial_display_name: "Alex",
    testimonial_anonymous: false,
    created_at: "2026-01-02T00:00:00Z",
  });

  assert(named?.displayLabel === "Alex", "named display label");
  assert(
    named?.testimonialText === "Very responsive team",
    "falls back to feedback_text",
  );
  passed += 1;

  const empty = mapTestimonialRowForValidation({
    id: "3",
    rating_overall: 3,
    what_went_well: null,
    feedback_text: "   ",
    testimonial_display_name: null,
    testimonial_anonymous: false,
    created_at: "2026-01-03T00:00:00Z",
  });

  assert(empty === null, "empty testimonial excluded");
  passed += 1;

  return { passed };
}
