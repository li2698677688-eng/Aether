import Link from "next/link";

import { CommunityShell } from "@/components/community/community-shell";
import { SubmissionList } from "@/components/community/submission-list";
import { buttonVariants } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth";
import { getMySubmissions } from "@/lib/community-repository";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const viewer = await requireViewer("/me/submissions");
  const jobs = await getMySubmissions(viewer);
  return (
    <CommunityShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Processing queue</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">我的投稿</h1>
          <p className="mt-3 text-sm text-muted-foreground">追踪采集、分析与审核进度。</p>
        </div>
        <Link className={buttonVariants({ variant: "default" })} href="/submit">提交新网站</Link>
      </div>
      <div className="mt-8 space-y-3">
        <SubmissionList initialJobs={jobs} />
      </div>
    </CommunityShell>
  );
}
