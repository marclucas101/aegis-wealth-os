/**
 * Client-side discover draft privacy controls.
 * Production: sensitive financial answers are never persisted in localStorage.
 */

const STORAGE_KEY = "aegis-discover-profile-v1";
const ROADMAP_STATUS_KEY = "aegis-roadmap-status-v1";
const META_KEY = "aegis-discover-draft-meta-v1";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type DiscoverDraftMeta = {
  userId: string;
  savedAt: string;
  currentStep?: number;
};

export function isSensitiveLocalDraftEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function discoverDraftStorageKey(userId?: string | null): string {
  if (!userId) {
    return STORAGE_KEY;
  }
  return `${STORAGE_KEY}:${userId}`;
}

export function discoverRoadmapStorageKey(userId?: string | null): string {
  if (!userId) {
    return ROADMAP_STATUS_KEY;
  }
  return `${ROADMAP_STATUS_KEY}:${userId}`;
}

export function readDiscoverDraftMeta(): DiscoverDraftMeta | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(META_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DiscoverDraftMeta;
    if (!parsed.userId || !parsed.savedAt) {
      return null;
    }
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (Number.isNaN(age) || age > DRAFT_TTL_MS) {
      clearDiscoverDraftStorage();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDiscoverDraftMeta(meta: DiscoverDraftMeta): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function clearDiscoverDraftStorage(userId?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const keys = new Set<string>([
    STORAGE_KEY,
    ROADMAP_STATUS_KEY,
    META_KEY,
    discoverDraftStorageKey(userId),
    discoverRoadmapStorageKey(userId),
  ]);

  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
}

export function assertDiscoverDraftBelongsToUser(userId: string): boolean {
  const meta = readDiscoverDraftMeta();
  if (!meta) {
    return true;
  }
  if (meta.userId !== userId) {
    clearDiscoverDraftStorage();
    return false;
  }
  return true;
}
