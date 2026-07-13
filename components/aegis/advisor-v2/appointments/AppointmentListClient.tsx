"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { AdvisorV2AppointmentsListResponse } from "@/app/api/advisor-v2/appointments/route";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import {
  buildAppointmentNewHref,
  CRM_V2_APPOINTMENT_LIST_VIEWS,
  listViewLabel,
} from "@/lib/crm-v2/appointments/routes";
import type { CrmAppointmentListView } from "@/lib/crm-v2/appointments/types";
import type { CrmAppointmentListItem, CrmAppointmentListPage } from "@/lib/crm-v2/appointments/types";

interface AppointmentListClientProps {
  initialPage: CrmAppointmentListPage;
}

export default function AppointmentListClient({ initialPage }: AppointmentListClientProps) {
  const [appointments, setAppointments] = useState<CrmAppointmentListItem[]>(
    initialPage.appointments,
  );
  const [view, setView] = useState<CrmAppointmentListView>(initialPage.view);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPage.page);
  const [totalPages, setTotalPages] = useState(initialPage.totalPages);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);

  const loadAppointments = useCallback(
    async (overrides?: {
      page?: number;
      q?: string;
      view?: CrmAppointmentListView;
    }) => {
      const nextPage = overrides?.page ?? page;
      const nextSearch = overrides?.q ?? search;
      const nextView = overrides?.view ?? view;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: "20",
          view: nextView,
        });
        if (nextSearch.trim()) params.set("q", nextSearch.trim());

        const response = await fetch(`/api/advisor-v2/appointments?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as AdvisorV2AppointmentsListResponse;

        if (!response.ok || !payload.ok) {
          setError(payload.ok ? "Failed to load appointments" : "Appointments unavailable");
          return;
        }

        setAppointments(payload.appointments);
        setTotalPages(payload.totalPages);
        setTotalCount(payload.totalCount);
        setPage(payload.page);
        setView(payload.view);
      } catch {
        setError("Failed to load appointments");
      } finally {
        setLoading(false);
      }
    },
    [page, search, view],
  );

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    void loadAppointments({ page: 1, q: search });
  }

  function handleViewChange(nextView: CrmAppointmentListView) {
    setView(nextView);
    void loadAppointments({ page: 1, view: nextView });
  }

  const emptyMessage =
    view === "requests"
      ? "No client appointment requests yet. Requests appear here when clients collaborate on scheduling."
      : view === "upcoming"
        ? "No upcoming appointments in this window. Schedule one from Relationships or New appointment."
        : view === "preparation"
          ? "No appointments currently in preparation."
          : view === "follow_up"
            ? "No appointments awaiting follow-up."
            : view === "history"
              ? "No appointment history in this window."
              : "Your agenda is clear for this week.";

  return (
    <div className="space-y-6">
      <CrmV2PageHeader
        title="Appointments"
        subtitle="Authoritative adviser appointment workflow for assigned relationships."
      />

      <div className="flex justify-end">
        <Link
          href={buildAppointmentNewHref()}
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          New appointment
        </Link>
      </div>

      <nav aria-label="Appointment views" className="flex flex-wrap gap-2">
        {CRM_V2_APPOINTMENT_LIST_VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleViewChange(item)}
            aria-current={view === item ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              view === item
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {listViewLabel(item)}
          </button>
        ))}
      </nav>

      <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="appointment-search">
          Search appointments
        </label>
        <input
          id="appointment-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by relationship or appointment label"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-600" role="status">
          Loading appointments…
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && appointments.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700">
          {emptyMessage}
        </p>
      ) : null}

      <ul className="space-y-3 md:hidden">
        {appointments.map((item) => (
          <li key={item.appointmentId}>
            <Link
              href={item.detailHref}
              className="block rounded-lg border border-slate-200 p-4 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <div className="font-medium text-slate-900">{item.clientDisplayName}</div>
              <div className="text-sm text-slate-600">{item.templateLabel}</div>
              <div className="mt-2 text-sm text-slate-700">
                <span className="font-medium">Status:</span> {item.lifecycleLabel}
              </div>
              <div className="text-sm text-slate-700">
                <span className="font-medium">When:</span>{" "}
                {new Date(item.startsAt).toLocaleString(undefined, {
                  timeZone: item.timezone,
                })}
              </div>
              <div className="text-sm text-slate-600">{item.locationSummary}</div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="px-3 py-2 font-medium">Relationship</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Date / time</th>
              <th className="px-3 py-2 font-medium">Lifecycle</th>
              <th className="px-3 py-2 font-medium">Preparation</th>
              <th className="px-3 py-2 font-medium">Mode</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments.map((item) => (
              <tr key={item.appointmentId}>
                <td className="px-3 py-3 font-medium text-slate-900">{item.clientDisplayName}</td>
                <td className="px-3 py-3 text-slate-700">{item.templateLabel}</td>
                <td className="px-3 py-3 text-slate-700">
                  {new Date(item.startsAt).toLocaleString(undefined, {
                    timeZone: item.timezone,
                  })}
                </td>
                <td className="px-3 py-3 text-slate-700">{item.lifecycleLabel}</td>
                <td className="px-3 py-3 text-slate-700">{item.preparationState.replace(/_/g, " ")}</td>
                <td className="px-3 py-3 text-slate-700">{item.locationSummary}</td>
                <td className="px-3 py-3">
                  <Link
                    href={item.detailHref}
                    className="font-medium text-slate-900 underline focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} ({totalCount} appointments)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void loadAppointments({ page: page - 1 })}
              className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => void loadAppointments({ page: page + 1 })}
              className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
