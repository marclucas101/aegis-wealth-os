"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { AdviserProfileResponse } from "@/app/api/advisor/profile/route";
import type { AdviserProfilePhotoResponse } from "@/app/api/advisor/profile/photo/route";
import type { AdviserProfileFormData } from "@/lib/aegis/myAdviser";

const SUGGESTED_INSURERS = [
  "Prudential",
  "AIA",
  "Great Eastern",
  "Income Insurance",
  "Manulife",
  "Singlife",
  "Other",
];

const EMPTY_FORM: AdviserProfileFormData = {
  displayName: "",
  professionalTitle: "",
  representingInsurer: "",
  organisation: "",
  phone: "",
  shortBio: "",
  yearsExperience: "",
  photoUrl: null,
  bookingEnabled: false,
  calendarConnected: false,
};

function ProfilePhotoPreview({
  photoUrl,
  displayName,
}: {
  photoUrl: string | null;
  displayName: string;
}) {
  const initials = (displayName || "A")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      <div className="relative h-24 w-24 overflow-hidden rounded-full border border-[#D1A866]/25">
        <Image
          src={photoUrl}
          alt="Your profile photo"
          fill
          className="object-cover"
          sizes="96px"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#D1A866]/25 bg-[#10283A] text-[#D1A866]/70">
      {initials}
    </div>
  );
}

export default function AdviserProfileSetupClient() {
  const [form, setForm] = useState<AdviserProfileFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/advisor/profile", { cache: "no-store" });
        const payload = (await response.json()) as AdviserProfileResponse;

        if (cancelled) return;

        if (response.ok && payload.ok) {
          setForm(payload.profile);
        } else {
          setError(
            payload.ok ? "Unable to load profile" : payload.error ?? "Unable to load profile",
          );
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/advisor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          professionalTitle: form.professionalTitle,
          representingInsurer: form.representingInsurer,
          organisation: form.organisation,
          phone: form.phone,
          shortBio: form.shortBio,
          yearsExperience: form.yearsExperience,
        }),
      });

      const payload = (await response.json()) as AdviserProfileResponse;

      if (!response.ok || !payload.ok) {
        setError(payload.ok ? "Save failed" : payload.error ?? "Save failed");
        return;
      }

      setForm(payload.profile);
      setMessage("Profile saved.");
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const body = new FormData();
      body.append("photo", file);

      const response = await fetch("/api/advisor/profile/photo", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as AdviserProfilePhotoResponse;

      if (!response.ok || !payload.ok) {
        setError(payload.ok ? "Upload failed" : payload.error ?? "Upload failed");
        return;
      }

      setForm(payload.profile);
      setMessage("Profile photo updated.");
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (loading) {
    return (
      <div className="h-40 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Public profile
        </p>
        <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
          This information appears on your clients&apos; My Adviser page.
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProfilePhotoPreview
            photoUrl={form.photoUrl}
            displayName={form.displayName}
          />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-sm border border-[#D1A866]/35 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/10 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
            <p className="mt-2 text-[10px] font-light text-[#F3F1EA]/30">
              JPG, PNG, or WebP · max 5 MB
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Display name
            </span>
            <input
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none focus:border-[#D1A866]/40"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Professional title
            </span>
            <input
              value={form.professionalTitle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  professionalTitle: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none focus:border-[#D1A866]/40"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Representing insurer
            </span>
            <input
              list="insurer-suggestions"
              value={form.representingInsurer}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  representingInsurer: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none focus:border-[#D1A866]/40"
            />
            <datalist id="insurer-suggestions">
              {SUGGESTED_INSURERS.map((insurer) => (
                <option key={insurer} value={insurer} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Organisation
            </span>
            <input
              value={form.organisation}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  organisation: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none focus:border-[#D1A866]/40"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Phone
            </span>
            <input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none focus:border-[#D1A866]/40"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Years of experience
            </span>
            <input
              inputMode="numeric"
              value={form.yearsExperience}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  yearsExperience: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none focus:border-[#D1A866]/40"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
            Short biography
          </span>
          <textarea
            rows={4}
            value={form.shortBio}
            onChange={(event) =>
              setForm((current) => ({ ...current, shortBio: event.target.value }))
            }
            className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none focus:border-[#D1A866]/40"
          />
        </label>
      </section>

      {error && (
        <p className="text-sm font-light text-red-300/80">{error}</p>
      )}
      {message && (
        <p className="text-sm font-light text-emerald-300/80">{message}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
