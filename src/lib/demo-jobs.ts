import { randomUUID } from "node:crypto";

import type { SiteStatus } from "@/types/site";

export interface DemoAnalysisJob {
  id: string;
  url: string;
  status: SiteStatus;
  createdAt: string;
  updatedAt: string;
  requester: string;
  attempts: number;
  errorCode?: string;
}

interface DemoStore {
  jobs: Map<string, DemoAnalysisJob>;
  webhookSignatures: Set<string>;
}

const globalStore = globalThis as typeof globalThis & { __designFeedDemoStore?: DemoStore };
const store = globalStore.__designFeedDemoStore ?? { jobs: new Map<string, DemoAnalysisJob>(), webhookSignatures: new Set<string>() };
globalStore.__designFeedDemoStore = store;

export function createDemoJob(url: string, requester: string) {
  const now = new Date().toISOString();
  const job: DemoAnalysisJob = {
    id: `job_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    url,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    requester,
    attempts: 0,
  };
  store.jobs.set(job.id, job);
  return job;
}

export function getDemoJob(id: string) {
  return store.jobs.get(id);
}

export function findDemoJobByUrl(url: string) {
  return [...store.jobs.values()].find((job) => job.url === url);
}

export function listDemoJobs() {
  return [...store.jobs.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function countRecentDemoJobs(requester: string, since: number) {
  return [...store.jobs.values()].filter((job) => job.requester === requester && Date.parse(job.createdAt) >= since).length;
}

export function countPendingDemoJobs(requester: string) {
  return [...store.jobs.values()].filter((job) => job.requester === requester && ["queued", "capturing", "analyzing", "in_review"].includes(job.status)).length;
}

export function updateDemoJob(id: string, patch: Partial<DemoAnalysisJob>) {
  const current = store.jobs.get(id);
  if (!current) return undefined;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  store.jobs.set(id, next);
  return next;
}

export function claimDemoWebhookSignature(signature: string) {
  if (store.webhookSignatures.has(signature)) return false;
  store.webhookSignatures.add(signature);
  return true;
}
