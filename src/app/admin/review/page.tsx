import { CommunityShell } from "@/components/community/community-shell";
import { AdminReviewBoard } from "@/components/community/admin-review-board";
import { requireAdmin } from "@/lib/auth";
import { getReviewQueue } from "@/lib/community-repository";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const viewer = await requireAdmin();
  const items = await getReviewQueue(viewer);
  return (
    <CommunityShell>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Moderation console</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">内容审核</h1>
        <p className="mt-3 text-sm text-muted-foreground">检查待审核内容；采集失败的任务也会保留在这里供人工重试。</p>
      </div>
      <AdminReviewBoard initialItems={items} />
    </CommunityShell>
  );
}
