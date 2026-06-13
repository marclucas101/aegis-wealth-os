import type { PublicTestimonial } from "@/lib/aegis/myAdviser";

export type TestimonialRowInput = {
  id: string;
  rating_overall: number;
  what_went_well: string | null;
  feedback_text: string | null;
  testimonial_display_name: string | null;
  testimonial_anonymous: boolean;
  created_at: string;
};

export function mapTestimonialRowForValidation(
  row: TestimonialRowInput,
): PublicTestimonial | null {
  const testimonialText =
    row.what_went_well?.trim() || row.feedback_text?.trim() || "";

  if (!testimonialText) {
    return null;
  }

  const displayLabel = row.testimonial_anonymous
    ? "Verified client"
    : row.testimonial_display_name?.trim() || "Verified client";

  return {
    id: row.id,
    ratingOverall: row.rating_overall,
    testimonialText,
    displayLabel,
    createdAt: row.created_at,
  };
}
