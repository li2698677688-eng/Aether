"use client";

import { CircleCheck, CircleX, Clock3, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SubmissionItem } from "@/lib/community-repository";
import { activeSubmissionStatuses, statusPresentation } from "@/lib/submission-status";
import type { SiteStatus } from "@/types/site";

const POLL_INTERVAL_MS = 8_000;

function StatusIcon({ status }: { status: SiteStatus }) {
  if (status === "published") return <CircleCheck aria-hidden="true" />;
  if (status === "failed") return <TriangleAlert aria-hidden="true" />;
  if (status === "rejected") return <CircleX aria-hidden="true" />;
  if (status === "capturing" || status === "analyzing") return <LoaderCircle aria-hidden="true" className="animate-spin" />;
  return <Clock3 aria-hidden="true" />;
}

export function SubmissionList({ initialJobs }: { initialJobs: SubmissionItem[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const activeJobIds = useMemo(
    () => jobs.filter((job) => activeSubmissionStatuses.has(job.status)).map((job) => job.id),
    [jobs],
  );
  const activeKey = activeJobIds.join(",");

  useEffect(() => {
    if (!activeKey) return;
    const controller = new AbortController();

    async function refresh() {
      if (document.visibilityState === "hidden") return;
      const updates = await Promise.all(activeJobIds.map(async (id) => {
        try {
          const response = await fetch(`/api/submissions/${id}/status`, {
            cache: "no-store",
            signal: controller.signal,
          });
          return response.ok ? await response.json() as SubmissionItem : undefined;
        } catch {
          return undefined;
        }
      }));
      const byId = new Map(updates.filter((job): job is SubmissionItem => Boolean(job)).map((job) => [job.id, job]));
      if (!byId.size) return;
      setJobs((current) => current.map((job) => byId.get(job.id) ?? job));
    }

    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [activeKey]); // eslint-disable-line react-hooks/exhaustive-deps -- activeKey is the stable polling membership contract.

  if (!jobs.length) {
    return (
      <div className="rounded-xl border bg-background p-12 text-center">
        <Clock3 aria-hidden="true" className="mx-auto size-6" />
        <h2 className="mt-3 font-semibold">还没有投稿</h2>
        <p className="mt-1 text-sm text-muted-foreground">提交一个公开网站后，采集与审核状态会显示在这里。</p>
        <Link className={`${buttonVariants()} mt-4`} href="/submit">投稿网站</Link>
      </div>
    );
  }

  return jobs.map((job) => {
    const presentation = statusPresentation(job.status);
    return (
      <Card className="shadow-none" key={job.id}>
        <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_120px_minmax(160px,.8fr)]">
          <div className="min-w-0">
            {job.status === "published" ? (
              <Link className="truncate font-medium underline-offset-4 hover:underline" href={`/sites/${job.slug}`}>{job.title}</Link>
            ) : <p className="truncate font-medium">{job.title}</p>}
            <p className="mt-1 truncate text-xs text-muted-foreground">{job.url}</p>
            {job.errorCode && <p className="mt-2 text-xs text-destructive">错误代码：{job.errorCode}</p>}
          </div>
          <Badge
            aria-live="polite"
            className="gap-1"
            variant={job.status === "published" ? "default" : job.status === "failed" || job.status === "rejected" ? "destructive" : "secondary"}
          >
            <StatusIcon status={job.status} /> {presentation.label}
          </Badge>
          <div>
            <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>{presentation.progress}%</span>
              <span>尝试 {job.attempts}/3</span>
            </div>
            <Progress value={presentation.progress} />
          </div>
        </CardContent>
      </Card>
    );
  });
}
