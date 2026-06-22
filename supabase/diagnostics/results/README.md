# Remote migration diagnostic results

Place operator-exported diagnostic rows here before remediation review.

## Required files (partial migrations)

Export **all rows** from each dedicated diagnostic (not rollup counts only):

| Migration | Diagnostic SQL | Expected result file |
|-----------|----------------|----------------------|
| `202606100020` | `verify_202606100020_google_calendar_booking.sql` | `202606100020_google_calendar_booking.json` |
| `202606150001` | `verify_202606150001_clients_user_id_unique.sql` | `202606150001_clients_user_id_unique.json` |
| `202606180001` | `verify_202606180001_birthday_reminders.sql` | `202606180001_birthday_reminders.json` |
| `202606180002` | `verify_202606180002_adviser_created_appointments.sql` | `202606180002_adviser_created_appointments.json` |

Optional informational export:

| Migration | File |
|-----------|------|
| `202606100019` | `202606100019_adviser_profiles.json` |
| `202606100021` | `202606100021_performance_indexes.json` |

## JSON row format

```json
[
  {
    "migration": "202606100020",
    "check_id": "table:adviser_calendar_connections",
    "expected_object": "public.adviser_calendar_connections",
    "present": false,
    "state": "absent",
    "detail": null
  }
]
```

`state` must be one of: `present`, `absent`, `conflicting`, `unknown`.

Include rows marked `absent`, `conflicting`, and `unknown`. Do not submit summary-only exports.
