"use client";

import { useState } from "react";

import {
  PROMOTION_CATEGORIES,
  PROMOTION_STATUSES,
  type PromotionCategory,
  type PromotionDetails,
  type PromotionRecord,
  type PromotionStatus,
} from "@/lib/aegis/promotions";

export type PromotionFormValues = {
  title: string;
  subtitle: string;
  category: PromotionCategory;
  summary: string;
  highlights: [string, string, string];
  eligibility: string;
  endsAt: string;
  ctaLabel: string;
  ctaUrl: string;
  status: PromotionStatus;
  priority: number;
};

type PromotionFormProps = {
  initialValues?: Partial<PromotionFormValues>;
  promotionId?: string;
  readOnly?: boolean;
  onSaved: (promotion: PromotionRecord) => void;
  onCancel?: () => void;
};

const CONTENT_GUIDANCE =
  "Keep each promotion concise: one clear client benefit, three key highlights, eligibility or deadline, and one call-to-action. Avoid overwhelming product detail. Detailed suitability and advice should happen through adviser consultation.";

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function emptyHighlights(): [string, string, string] {
  return ["", "", ""];
}

export function promotionToFormValues(
  promotion: PromotionRecord,
): PromotionFormValues {
  const highlights = emptyHighlights();
  promotion.details?.highlights?.forEach((item, index) => {
    if (index < 3) {
      highlights[index] = item;
    }
  });

  return {
    title: promotion.title,
    subtitle: promotion.subtitle ?? "",
    category: promotion.category,
    summary: promotion.summary,
    highlights,
    eligibility: promotion.details?.eligibility ?? "",
    endsAt: toDateInputValue(promotion.endsAt),
    ctaLabel: promotion.ctaLabel ?? "",
    ctaUrl: promotion.ctaUrl ?? "",
    status: promotion.status,
    priority: promotion.priority,
  };
}

function buildDetails(values: PromotionFormValues): PromotionDetails | null {
  const highlights = values.highlights.map((item) => item.trim()).filter(Boolean);
  const eligibility = values.eligibility.trim();

  if (!highlights.length && !eligibility) {
    return null;
  }

  return {
    highlights: highlights.length ? highlights : undefined,
    eligibility: eligibility || undefined,
  };
}

export default function PromotionForm({
  initialValues,
  promotionId,
  readOnly = false,
  onSaved,
  onCancel,
}: PromotionFormProps) {
  const [values, setValues] = useState<PromotionFormValues>({
    title: initialValues?.title ?? "",
    subtitle: initialValues?.subtitle ?? "",
    category: initialValues?.category ?? "General",
    summary: initialValues?.summary ?? "",
    highlights: initialValues?.highlights ?? emptyHighlights(),
    eligibility: initialValues?.eligibility ?? "",
    endsAt: initialValues?.endsAt ?? "",
    ctaLabel: initialValues?.ctaLabel ?? "Speak to my adviser",
    ctaUrl: initialValues?.ctaUrl ?? "",
    status: initialValues?.status ?? "draft",
    priority: initialValues?.priority ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"image" | "attachment" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function savePromotion(): Promise<PromotionRecord | null> {
    setSaving(true);
    setError(null);

    const payload = {
      title: values.title,
      subtitle: values.subtitle || null,
      category: values.category,
      summary: values.summary,
      details: buildDetails(values),
      ends_at: values.endsAt ? new Date(`${values.endsAt}T23:59:59`).toISOString() : null,
      cta_label: values.ctaLabel || null,
      cta_url: values.ctaUrl || null,
      status: values.status,
      priority: values.priority,
    };

    const url = promotionId
      ? `/api/advisor/promotions/${promotionId}`
      : "/api/advisor/promotions";
    const method = promotionId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as
      | { ok: true; promotion: PromotionRecord }
      | { ok: false; error?: string };

    setSaving(false);

    if (!response.ok || !data.ok) {
      setError(data.ok ? "Failed to save promotion" : data.error ?? "Failed to save promotion");
      return null;
    }

    onSaved(data.promotion);
    return data.promotion;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await savePromotion();
  }

  async function handleAssetUpload(kind: "image" | "attachment", file: File) {
    let targetId = promotionId;

    if (!targetId) {
      const created = await savePromotion();
      if (!created) {
        return;
      }
      targetId = created.id;
    }

    setUploading(kind);
    setError(null);

    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("file", file);

    const response = await fetch(`/api/advisor/promotions/${targetId}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as
      | { ok: true; promotion: PromotionRecord }
      | { ok: false; error?: string };

    setUploading(null);

    if (!response.ok || !data.ok) {
      setError(data.ok ? "Failed to upload file" : data.error ?? "Failed to upload file");
      return;
    }

    onSaved(data.promotion);
  }

  return (
    <form onSubmit={readOnly ? (event) => event.preventDefault() : handleSubmit} className="space-y-6">
      <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/35 p-4 sm:p-5">
        <p className="text-xs font-light leading-relaxed text-[#F3F1EA]/45">
          {CONTENT_GUIDANCE}
        </p>
      </div>

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-light text-red-200/80">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Title" hint="Max 80 characters">
          <input
            value={values.title}
            maxLength={80}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
            className={INPUT_CLASS}
            required
            disabled={readOnly}
          />
        </Field>

        <Field label="Category">
          <select
            value={values.category}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                category: event.target.value as PromotionCategory,
              }))
            }
            className={INPUT_CLASS}
            disabled={readOnly}
          >
            {PROMOTION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Subtitle / hook" hint="Max 140 characters">
        <input
          value={values.subtitle}
          maxLength={140}
          onChange={(event) =>
            setValues((current) => ({ ...current, subtitle: event.target.value }))
          }
          className={INPUT_CLASS}
          disabled={readOnly}
        />
      </Field>

      <Field label="Short summary" hint="Max 300 characters">
        <textarea
          value={values.summary}
          maxLength={300}
          rows={3}
          onChange={(event) =>
            setValues((current) => ({ ...current, summary: event.target.value }))
          }
          className={INPUT_CLASS}
          required
          disabled={readOnly}
        />
      </Field>

      <div className="space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/60">
          Key highlights (optional)
        </p>
        {values.highlights.map((highlight, index) => (
          <Field
            key={`highlight-${index}`}
            label={`Highlight ${index + 1}`}
            hint="Max 120 characters"
          >
            <input
              value={highlight}
              maxLength={120}
              onChange={(event) =>
                setValues((current) => {
                  const next = [...current.highlights] as [string, string, string];
                  next[index] = event.target.value;
                  return { ...current, highlights: next };
                })
              }
              className={INPUT_CLASS}
              disabled={readOnly}
            />
          </Field>
        ))}
      </div>

      <Field label="Eligibility note" hint="Optional, max 180 characters">
        <input
          value={values.eligibility}
          maxLength={180}
          onChange={(event) =>
            setValues((current) => ({ ...current, eligibility: event.target.value }))
          }
          className={INPUT_CLASS}
        />
      </Field>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Valid until / campaign end date">
          <input
            type="date"
            value={values.endsAt}
            onChange={(event) =>
              setValues((current) => ({ ...current, endsAt: event.target.value }))
            }
            className={INPUT_CLASS}
            disabled={readOnly}
          />
        </Field>

        <Field label="Priority">
          <input
            type="number"
            value={values.priority}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                priority: Number(event.target.value) || 0,
              }))
            }
            className={INPUT_CLASS}
            disabled={readOnly}
          />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="CTA label">
          <input
            value={values.ctaLabel}
            maxLength={60}
            onChange={(event) =>
              setValues((current) => ({ ...current, ctaLabel: event.target.value }))
            }
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="CTA URL" hint="Optional internal path or https URL">
          <input
            value={values.ctaUrl}
            onChange={(event) =>
              setValues((current) => ({ ...current, ctaUrl: event.target.value }))
            }
            className={INPUT_CLASS}
            placeholder="/profile or https://"
          />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Status">
          <select
            value={values.status}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                status: event.target.value as PromotionStatus,
              }))
            }
            className={INPUT_CLASS}
            disabled={readOnly}
          >
            {PROMOTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Banner image" hint="PNG, JPG, or WebP up to 5MB">
          {!readOnly && (
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleAssetUpload("image", file);
              }
            }}
            className="block w-full text-xs text-[#F3F1EA]/55 file:mr-3 file:rounded-sm file:border file:border-[#D1A866]/25 file:bg-[#071B2A]/80 file:px-3 file:py-2 file:text-[10px] file:uppercase file:tracking-wider file:text-[#D1A866]"
          />
          )}
          {readOnly && (
            <p className="text-xs font-light text-[#F3F1EA]/40">Uploads disabled in read-only mode.</p>
          )}
        </Field>
      </div>

      <Field label="Attachment" hint="PDF or document up to 10MB">
        {!readOnly && (
        <input
          type="file"
          accept=".pdf,.doc,.docx,image/png,image/jpeg"
          disabled={uploading !== null}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleAssetUpload("attachment", file);
            }
          }}
          className="block w-full text-xs text-[#F3F1EA]/55 file:mr-3 file:rounded-sm file:border file:border-[#D1A866]/25 file:bg-[#071B2A]/80 file:px-3 file:py-2 file:text-[10px] file:uppercase file:tracking-wider file:text-[#D1A866]"
        />
        )}
        {readOnly && (
          <p className="text-xs font-light text-[#F3F1EA]/40">Uploads disabled in read-only mode.</p>
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        {!readOnly && (
        <button
          type="submit"
          disabled={saving || uploading !== null}
          className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:opacity-50"
        >
          {saving ? "Saving…" : promotionId ? "Save changes" : "Create promotion"}
        </button>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex rounded-sm border border-[#F3F1EA]/15 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/55 transition-colors hover:border-[#F3F1EA]/25 hover:text-[#F3F1EA]/75"
          >
            Cancel
          </button>
        )}

        {uploading && (
          <span className="text-xs font-light text-[#F3F1EA]/45">
            Uploading {uploading}…
          </span>
        )}
      </div>
    </form>
  );
}

const INPUT_CLASS =
  "w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/40";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[10px] font-light text-[#F3F1EA]/30">{hint}</span>
      )}
    </label>
  );
}
