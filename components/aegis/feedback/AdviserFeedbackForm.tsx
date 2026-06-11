"use client";

import { useState } from "react";

import RatingSelector from "@/components/aegis/feedback/RatingSelector";
import {
  TESTIMONIAL_DISPLAY_PREFERENCES,
  type TestimonialDisplayPreference,
} from "@/lib/aegis/adviserFeedback";

type AdviserFeedbackFormProps = {
  adviserName?: string | null;
  onSubmitted: () => void;
  onCancel?: () => void;
};

const INPUT_CLASS =
  "w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/40";

export default function AdviserFeedbackForm({
  adviserName,
  onSubmitted,
  onCancel,
}: AdviserFeedbackFormProps) {
  const [ratingOverall, setRatingOverall] = useState<number | null>(null);
  const [ratingClarity, setRatingClarity] = useState<number | null>(null);
  const [ratingResponsiveness, setRatingResponsiveness] = useState<number | null>(null);
  const [ratingTrust, setRatingTrust] = useState<number | null>(null);
  const [ratingProfessionalism, setRatingProfessionalism] = useState<number | null>(
    null,
  );
  const [whatWentWell, setWhatWentWell] = useState("");
  const [whatCouldImprove, setWhatCouldImprove] = useState("");
  const [permissionToUseAsTestimonial, setPermissionToUseAsTestimonial] =
    useState(false);
  const [testimonialDisplayPreference, setTestimonialDisplayPreference] =
    useState<TestimonialDisplayPreference>("anonymous");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!ratingOverall) {
      setError("Please provide an overall experience rating.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/adviser-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating_overall: ratingOverall,
        rating_clarity: ratingClarity,
        rating_responsiveness: ratingResponsiveness,
        rating_trust: ratingTrust,
        rating_professionalism: ratingProfessionalism,
        what_went_well: whatWentWell || null,
        what_could_improve: whatCouldImprove || null,
        permission_to_use_as_testimonial: permissionToUseAsTestimonial,
        testimonial_display_preference: permissionToUseAsTestimonial
          ? testimonialDisplayPreference
          : "anonymous",
      }),
    });

    const data = (await response.json()) as { ok: boolean; error?: string };
    setSaving(false);

    if (!response.ok || !data.ok) {
      setError(data.error ?? "Failed to submit feedback");
      return;
    }

    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {adviserName && (
        <p className="text-sm font-light text-[#F3F1EA]/55">
          Sharing feedback on your experience with{" "}
          <span className="text-[#F3F1EA]/80">{adviserName}</span>.
        </p>
      )}

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-light text-red-200/80">
          {error}
        </div>
      )}

      <RatingSelector
        label="Overall experience"
        value={ratingOverall}
        onChange={setRatingOverall}
        required
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <RatingSelector
          label="Clarity of explanation"
          value={ratingClarity}
          onChange={setRatingClarity}
        />
        <RatingSelector
          label="Responsiveness"
          value={ratingResponsiveness}
          onChange={setRatingResponsiveness}
        />
        <RatingSelector
          label="Trust & confidence"
          value={ratingTrust}
          onChange={setRatingTrust}
        />
        <RatingSelector
          label="Professionalism"
          value={ratingProfessionalism}
          onChange={setRatingProfessionalism}
        />
      </div>

      <label className="block space-y-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
          What went well?
        </span>
        <textarea
          value={whatWentWell}
          onChange={(event) => setWhatWentWell(event.target.value)}
          rows={3}
          className={INPUT_CLASS}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
          What could be improved?
        </span>
        <textarea
          value={whatCouldImprove}
          onChange={(event) => setWhatCouldImprove(event.target.value)}
          rows={3}
          className={INPUT_CLASS}
        />
      </label>

      <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={permissionToUseAsTestimonial}
            onChange={(event) => {
              setPermissionToUseAsTestimonial(event.target.checked);
              if (!event.target.checked) {
                setTestimonialDisplayPreference("anonymous");
              }
            }}
            className="mt-1"
          />
          <span className="text-sm font-light leading-relaxed text-[#F3F1EA]/60">
            I allow AEGIS to use this feedback as a testimonial. This is
            optional and separate from general quality feedback.
          </span>
        </label>

        {permissionToUseAsTestimonial && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/35">
              Display preference
            </p>
            <div className="flex flex-wrap gap-2">
              {TESTIMONIAL_DISPLAY_PREFERENCES.map((preference) => (
                <button
                  key={preference}
                  type="button"
                  onClick={() => setTestimonialDisplayPreference(preference)}
                  className={`rounded-sm border px-3 py-2 text-[10px] uppercase tracking-wider transition-colors ${
                    testimonialDisplayPreference === preference
                      ? "border-[#D1A866]/45 bg-[#D1A866]/12 text-[#D1A866]"
                      : "border-[#F3F1EA]/12 text-[#F3F1EA]/45 hover:border-[#F3F1EA]/20"
                  }`}
                >
                  {preference.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit feedback"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex rounded-sm border border-[#F3F1EA]/15 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/55 transition-colors hover:border-[#F3F1EA]/25"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
