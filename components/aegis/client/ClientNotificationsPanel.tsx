"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClientNotification = {
  id: string;
  type: string;
  title: string;
  summary: string;
  referenceType: string | null;
  referenceId: string | null;
  destinationRoute: string | null;
  readAt: string | null;
  createdAt: string;
};

const ALLOWED_ROUTES = new Set([
  "/document-vault",
  "/insights",
  "/goals-reviews",
  "/dashboard",
]);

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function resolveDestination(notification: ClientNotification): string | null {
  if (
    notification.destinationRoute &&
    ALLOWED_ROUTES.has(notification.destinationRoute)
  ) {
    return notification.destinationRoute;
  }

  switch (notification.referenceType) {
    case "document":
      return "/document-vault";
    case "governed_content":
      return "/insights";
    case "client_review_submission":
      return "/goals-reviews";
    case "published_output":
      return "/dashboard";
    default:
      return null;
  }
}

export default function ClientNotificationsPanel() {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/client/notifications", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Failed to load notifications");
          setNotifications([]);
          return;
        }
        setNotifications(data.notifications ?? []);
      } catch {
        if (!cancelled) {
          setError("Failed to load notifications");
          setNotifications([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/notifications", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load notifications");
        setNotifications([]);
        return;
      }
      setNotifications(data.notifications ?? []);
    } catch {
      setError("Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(notification: ClientNotification) {
    if (notification.readAt) {
      return;
    }

    try {
      const res = await fetch(`/api/client/notifications/${notification.id}`, {
        method: "PATCH",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return;
      }

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: data.notification.readAt }
            : item,
        ),
      );
    } catch {
      // Non-blocking.
    }
  }

  async function openNotification(notification: ClientNotification) {
    await markRead(notification);
    const destination = resolveDestination(notification);
    if (!destination) {
      setStaleIds((prev) => new Set(prev).add(notification.id));
    }
  }

  if (loading) {
    return (
      <section
        className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4"
        aria-busy="true"
        aria-label="Notifications loading"
      >
        <p className="text-sm text-[#F3F1EA]/55">Loading notifications…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="rounded-sm border border-red-400/30 bg-[#071B2A]/40 p-4"
        aria-live="polite"
      >
        <p className="text-sm text-red-200/90">{error}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-3 text-xs uppercase tracking-[0.16em] text-[#D1A866] underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </section>
    );
  }

  if (notifications.length === 0) {
    return (
      <section className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4">
        <h2 className="text-sm font-medium text-[#F3F1EA]/90">Notifications</h2>
        <p className="mt-2 text-sm text-[#F3F1EA]/55">
          When your adviser shares updates, they will appear here.
        </p>
      </section>
    );
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <section
      className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4"
      aria-label={`Notifications, ${unreadCount} unread`}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[#F3F1EA]/90">Notifications</h2>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-[#D1A866]/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#D1A866]">
            {unreadCount} unread
          </span>
        ) : null}
      </header>

      <ul className="space-y-3">
        {notifications.map((notification) => {
          const destination = resolveDestination(notification);
          const isStale = staleIds.has(notification.id);
          const unread = !notification.readAt;

          return (
            <li
              key={notification.id}
              className={`rounded-sm border p-3 ${
                unread
                  ? "border-[#D1A866]/35 bg-[#0B2435]/70"
                  : "border-[#D1A866]/10 bg-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[#F3F1EA]/90">{notification.title}</p>
                  <p className="mt-1 text-xs text-[#F3F1EA]/55">{notification.summary}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/35">
                    {formatWhen(notification.createdAt)}
                  </p>
                </div>
                {unread ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D1A866]" aria-hidden />
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                {destination && !isStale ? (
                  <Link
                    href={destination}
                    onClick={() => void openNotification(notification)}
                    className="text-xs uppercase tracking-[0.14em] text-[#D1A866] underline-offset-2 hover:underline"
                  >
                    View in portal
                  </Link>
                ) : (
                  <span className="text-xs text-[#F3F1EA]/45">
                    This item is no longer available in your portal.
                  </span>
                )}
                {unread ? (
                  <button
                    type="button"
                    onClick={() => void markRead(notification)}
                    className="text-xs uppercase tracking-[0.14em] text-[#F3F1EA]/55 underline-offset-2 hover:underline"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
