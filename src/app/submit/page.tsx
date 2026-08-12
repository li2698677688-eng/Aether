import { CommunityShell } from "@/components/community/community-shell";
import { SubmissionForm } from "@/components/community/submission-form";
import { requireViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  await requireViewer("/submit");
  return (
    <CommunityShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Community intake</p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
            把值得研究的网站，带进 DesignFeed。
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
            我们分别采集桌面与移动页面，再把可验证的页面证据和 AI 推断清楚分开。你可以随时回来看任务状态。
          </p>
        </div>
        <SubmissionForm />
      </div>
    </CommunityShell>
  );
}
