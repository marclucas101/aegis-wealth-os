import "server-only";

import type {
  AdviserProfileFormData,
  MyAdviserPageData,
  MyAdviserProfile,
  PublicTestimonial,
} from "@/lib/aegis/myAdviser";
import { EMPTY_MY_ADVISER_PAGE } from "@/lib/aegis/myAdviser";
import { mapTestimonialRowForValidation } from "@/src/lib/myAdviser/testimonialMapping";

import { createAdminSupabaseClient } from "./admin";
import { ensureUserClientProfile } from "./userProfile";
import type { AppUserRow } from "./userProfile";

export const ADVISER_PHOTO_BUCKET = "adviser-photos";
export const ADVISER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const ADVISER_PHOTO_SIGNED_URL_SECONDS = 3600;

export const ADVISER_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AdviserProfileRow = {
  adviser_user_id: string;
  display_name: string | null;
  photo_storage_path: string | null;
  professional_title: string | null;
  representing_insurer: string | null;
  short_bio: string | null;
  years_experience: number | null;
  calendar_connected: boolean;
  booking_enabled: boolean;
};

type AdviserUserRow = Pick<
  AppUserRow,
  "id" | "full_name" | "organisation" | "phone" | "avatar_url"
>;

type TestimonialRow = {
  id: string;
  rating_overall: number;
  what_went_well: string | null;
  feedback_text: string | null;
  testimonial_display_name: string | null;
  testimonial_anonymous: boolean;
  created_at: string;
};

export type AdviserProfileUpdateInput = {
  displayName?: string | null;
  professionalTitle?: string | null;
  representingInsurer?: string | null;
  shortBio?: string | null;
  yearsExperience?: number | null;
  phone?: string | null;
  organisation?: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveDisplayName(
  profile: AdviserProfileRow | null,
  user: AdviserUserRow,
): string | null {
  return (
    profile?.display_name?.trim() ||
    user.full_name?.trim() ||
    null
  );
}

async function createPhotoSignedUrl(
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath) return null;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(ADVISER_PHOTO_BUCKET)
    .createSignedUrl(storagePath, ADVISER_PHOTO_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function loadAdviserUserAndProfile(
  adviserUserId: string,
): Promise<{
  user: AdviserUserRow | null;
  profile: AdviserProfileRow | null;
}> {
  const admin = createAdminSupabaseClient();

  const [userResult, profileResult] = await Promise.all([
    admin
      .from("users")
      .select("id, full_name, organisation, phone, avatar_url")
      .eq("id", adviserUserId)
      .maybeSingle(),
    admin
      .from("adviser_profiles")
      .select("*")
      .eq("adviser_user_id", adviserUserId)
      .maybeSingle(),
  ]);

  if (userResult.error) {
    throw new Error(`Failed to load adviser user: ${userResult.error.message}`);
  }

  if (profileResult.error) {
    throw new Error(
      `Failed to load adviser profile: ${profileResult.error.message}`,
    );
  }

  return {
    user: userResult.data as AdviserUserRow | null,
    profile: profileResult.data as AdviserProfileRow | null,
  };
}

async function mapToPublicProfile(
  adviserUserId: string,
  user: AdviserUserRow,
  profile: AdviserProfileRow | null,
): Promise<MyAdviserProfile> {
  const photoUrl =
    (await createPhotoSignedUrl(profile?.photo_storage_path ?? null)) ??
    user.avatar_url?.trim() ??
    null;

  return {
    adviserUserId,
    displayName: resolveDisplayName(profile, user),
    professionalTitle: profile?.professional_title?.trim() ?? null,
    representingInsurer: profile?.representing_insurer?.trim() ?? null,
    organisation: user.organisation?.trim() ?? null,
    shortBio: profile?.short_bio?.trim() ?? null,
    yearsExperience: profile?.years_experience ?? null,
    phone: user.phone?.trim() ?? null,
    photoUrl,
    bookingEnabled: profile?.booking_enabled ?? false,
    calendarConnected: profile?.calendar_connected ?? false,
  };
}

export async function listApprovedTestimonialsForAdviser(
  adviserUserId: string,
): Promise<PublicTestimonial[]> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("adviser_feedback")
    .select(
      "id, rating_overall, what_went_well, feedback_text, testimonial_display_name, testimonial_anonymous, created_at",
    )
    .eq("adviser_user_id", adviserUserId)
    .eq("status", "approved_testimonial")
    .eq("permission_to_use_as_testimonial", true)
    .order("rating_overall", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load testimonials: ${error.message}`);
  }

  return ((data ?? []) as TestimonialRow[])
    .map(mapTestimonialRowForValidation)
    .filter((item): item is PublicTestimonial => item !== null);
}

/**
 * Loads the authenticated client's assigned adviser profile and approved
 * testimonials. Adviser identity is derived from clients.advisor_user_id only.
 */
export async function loadMyAdviserPageData(): Promise<
  | { ok: false; reason: "unauthenticated" }
  | { ok: true; data: MyAdviserPageData }
> {
  const session = await ensureUserClientProfile();

  if (!session.authenticated) {
    return { ok: false, reason: "unauthenticated" };
  }

  const adviserUserId = session.client.advisor_user_id;
  if (!adviserUserId) {
    return { ok: true, data: EMPTY_MY_ADVISER_PAGE };
  }

  const { user, profile } = await loadAdviserUserAndProfile(adviserUserId);
  if (!user) {
    return {
      ok: true,
      data: {
        assigned: true,
        adviser: null,
        testimonials: [],
      },
    };
  }

  const [adviser, testimonials] = await Promise.all([
    mapToPublicProfile(adviserUserId, user, profile),
    listApprovedTestimonialsForAdviser(adviserUserId),
  ]);

  return {
    ok: true,
    data: {
      assigned: true,
      adviser,
      testimonials,
    },
  };
}

export async function loadAdviserOwnProfile(
  adviserUserId: string,
): Promise<AdviserProfileFormData> {
  const { user, profile } = await loadAdviserUserAndProfile(adviserUserId);

  if (!user) {
    throw new Error("Adviser user record not found");
  }

  const photoUrl =
    (await createPhotoSignedUrl(profile?.photo_storage_path ?? null)) ??
    user.avatar_url?.trim() ??
    null;

  return {
    displayName: resolveDisplayName(profile, user) ?? "",
    professionalTitle: profile?.professional_title?.trim() ?? "",
    representingInsurer: profile?.representing_insurer?.trim() ?? "",
    organisation: user.organisation?.trim() ?? "",
    phone: user.phone?.trim() ?? "",
    shortBio: profile?.short_bio?.trim() ?? "",
    yearsExperience:
      profile?.years_experience != null
        ? String(profile.years_experience)
        : "",
    photoUrl,
    bookingEnabled: profile?.booking_enabled ?? false,
    calendarConnected: profile?.calendar_connected ?? false,
  };
}

export async function upsertAdviserProfile(
  adviserUserId: string,
  input: AdviserProfileUpdateInput,
): Promise<AdviserProfileFormData> {
  const admin = createAdminSupabaseClient();

  const userUpdates: Partial<AppUserRow> = {};
  if (input.phone !== undefined) {
    userUpdates.phone = trimOrNull(input.phone);
  }
  if (input.organisation !== undefined) {
    userUpdates.organisation = trimOrNull(input.organisation);
  }
  if (input.displayName !== undefined) {
    userUpdates.full_name = trimOrNull(input.displayName);
  }

  if (Object.keys(userUpdates).length > 0) {
    const { error: userError } = await admin
      .from("users")
      .update(userUpdates as never)
      .eq("id", adviserUserId);

    if (userError) {
      throw new Error(`Failed to update adviser user: ${userError.message}`);
    }
  }

  const profilePayload: Record<string, unknown> = {
    adviser_user_id: adviserUserId,
  };

  if (input.displayName !== undefined) {
    profilePayload.display_name = trimOrNull(input.displayName);
  }
  if (input.professionalTitle !== undefined) {
    profilePayload.professional_title = trimOrNull(input.professionalTitle);
  }
  if (input.representingInsurer !== undefined) {
    profilePayload.representing_insurer = trimOrNull(input.representingInsurer);
  }
  if (input.shortBio !== undefined) {
    profilePayload.short_bio = trimOrNull(input.shortBio);
  }
  if (input.yearsExperience !== undefined) {
    profilePayload.years_experience = input.yearsExperience;
  }

  if (Object.keys(profilePayload).length > 1) {
    const { error: profileError } = await admin
      .from("adviser_profiles")
      .upsert(profilePayload as never, { onConflict: "adviser_user_id" });

    if (profileError) {
      throw new Error(`Failed to save adviser profile: ${profileError.message}`);
    }
  }

  return loadAdviserOwnProfile(adviserUserId);
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export async function uploadAdviserProfilePhoto(
  adviserUserId: string,
  file: File,
): Promise<AdviserProfileFormData> {
  if (!ADVISER_PHOTO_MIME_TYPES.includes(file.type as (typeof ADVISER_PHOTO_MIME_TYPES)[number])) {
    throw new Error("Photo must be JPG, PNG, or WebP");
  }

  if (file.size <= 0 || file.size > ADVISER_PHOTO_MAX_BYTES) {
    throw new Error("Photo must be between 1 byte and 5 MB");
  }

  const admin = createAdminSupabaseClient();
  const extension = extensionForMime(file.type);
  const storagePath = `${adviserUserId}/profile/${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { data: existing } = await admin
    .from("adviser_profiles")
    .select("photo_storage_path")
    .eq("adviser_user_id", adviserUserId)
    .maybeSingle();

  const oldPath = (existing as { photo_storage_path?: string | null } | null)
    ?.photo_storage_path;

  const { error: uploadError } = await admin.storage
    .from(ADVISER_PHOTO_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload photo: ${uploadError.message}`);
  }

  const { error: profileError } = await admin
    .from("adviser_profiles")
    .upsert(
      {
        adviser_user_id: adviserUserId,
        photo_storage_path: storagePath,
      } as never,
      { onConflict: "adviser_user_id" },
    );

  if (profileError) {
    await admin.storage.from(ADVISER_PHOTO_BUCKET).remove([storagePath]);
    throw new Error(`Failed to save photo reference: ${profileError.message}`);
  }

  if (oldPath && oldPath !== storagePath) {
    await admin.storage.from(ADVISER_PHOTO_BUCKET).remove([oldPath]);
  }

  return loadAdviserOwnProfile(adviserUserId);
}
