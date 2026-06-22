import "server-only";

import type { JobHandler, JobName } from "./types";
import { runScheduledPublishingJob } from "./scheduledPublishingJob";

const HANDLERS: Record<JobName, JobHandler> = {
  scheduled_publishing: runScheduledPublishingJob,
};

export function isRegisteredJobName(value: string): value is JobName {
  return value in HANDLERS;
}

export function getJobHandler(jobName: JobName): JobHandler {
  return HANDLERS[jobName];
}

export function listRegisteredJobNames(): JobName[] {
  return Object.keys(HANDLERS) as JobName[];
}
