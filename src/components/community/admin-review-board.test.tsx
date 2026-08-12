import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminReviewBoard } from "@/components/community/admin-review-board";
import { featuredSites } from "@/data/sites";
import type { ReviewItem } from "@/lib/community-repository";
import { createRemixArtifactFixture } from "@/test/fixtures/remix-artifact";

afterEach(() => vi.restoreAllMocks());

describe("AdminReviewBoard Remix review", () => {
  it("requires the verified artifact evidence to be inspected before publishing", async () => {
    const artifact = createRemixArtifactFixture();
    const item: ReviewItem = {
      id: artifact.reference.siteId,
      jobId: "review-job-1",
      submittedBy: "@lin",
      category: "SaaS",
      attempts: 1,
      artifactReviewed: false,
      site: { ...featuredSites[0], id: artifact.reference.siteId, remixArtifact: artifact, status: "in_review" },
      demo: true,
    };
    render(<AdminReviewBoard initialItems={[item]} />);

    expect(screen.getByRole("button", { name: "通过" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "检查复刻证据" }));

    expect(screen.getByRole("heading", { name: "审核复刻证据" })).toBeInTheDocument();
    expect(screen.getByText("96.0%")).toBeInTheDocument();
    expect(screen.getByText("375px")).toBeInTheDocument();
    expect(screen.getByText("1920px")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /源页面/ })).toHaveLength(4);
    expect(screen.getAllByRole("link", { name: /复刻结果/ })).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: "确认已检查全部证据" }));

    expect(screen.getByRole("button", { name: "通过" })).toBeEnabled();
    expect(screen.getByText("复刻证据已人工确认")).toBeInTheDocument();
  });

  it("blocks approval when the deterministic Remix artifact is missing", () => {
    const item: ReviewItem = {
      id: "site-without-artifact",
      jobId: "review-job-2",
      submittedBy: "@lin",
      category: "SaaS",
      attempts: 1,
      artifactReviewed: false,
      site: { ...featuredSites[0], id: "site-without-artifact", status: "in_review" },
      demo: true,
    };

    render(<AdminReviewBoard initialItems={[item]} />);

    expect(screen.getByText("复刻产物缺失，不能发布")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通过" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "检查复刻证据" })).not.toBeInTheDocument();
  });

  it("persists the artifact review acknowledgement and selected category before publishing", async () => {
    const artifact = createRemixArtifactFixture();
    const item: ReviewItem = {
      id: artifact.reference.siteId,
      jobId: "019fd13c-cb90-78b3-b99c-597458479aa4",
      submittedBy: "@lin",
      category: "SaaS",
      attempts: 1,
      durationMs: 42000,
      artifactReviewed: false,
      site: { ...featuredSites[0], id: artifact.reference.siteId, remixArtifact: artifact, status: "in_review" },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<AdminReviewBoard initialItems={[item]} />);

    await userEvent.click(screen.getByRole("button", { name: "检查复刻证据" }));
    await userEvent.click(screen.getByRole("button", { name: "确认已检查全部证据" }));
    await userEvent.click(screen.getByRole("button", { name: "通过" }));

    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/sites/${item.id}/approve`, expect.objectContaining({ method: "POST" }));
    const approvalBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(approvalBody).toEqual(expect.objectContaining({ category: "SaaS", remixArtifactReviewed: true }));
    expect(approvalBody).not.toHaveProperty("remixPrompt");
    expect(approvalBody).not.toHaveProperty("designSpec");
    expect(await screen.findByText(`${item.id} 已通过`)).toBeInTheDocument();
    expect(screen.queryByText(item.site.title)).not.toBeInTheDocument();
  });

  it("lets an administrator validate and publish a corrected DesignSpec", async () => {
    const artifact = createRemixArtifactFixture();
    const item: ReviewItem = {
      id: artifact.reference.siteId,
      jobId: "019fd13c-cb90-78b3-b99c-597458479aa4",
      submittedBy: "@lin",
      category: "SaaS",
      attempts: 1,
      durationMs: 42000,
      artifactReviewed: false,
      site: { ...featuredSites[0], id: artifact.reference.siteId, remixArtifact: artifact, status: "in_review" },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<AdminReviewBoard initialItems={[item]} />);

    await userEvent.click(screen.getByRole("button", { name: "编辑设计规范" }));
    const editor = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "DesignSpec JSON" });
    const correctedSpec = { ...item.site.designSpec!, overview: { ...item.site.designSpec!.overview, description: "管理员修订后的描述" } };
    fireEvent.change(editor, { target: { value: JSON.stringify(correctedSpec) } });
    await userEvent.click(screen.getByRole("button", { name: "保存设计规范修订" }));

    expect(screen.getByText("设计规范已人工修订")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "检查复刻证据" }));
    await userEvent.click(screen.getByRole("button", { name: "确认已检查全部证据" }));
    await userEvent.click(screen.getByRole("button", { name: "通过" }));

    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/sites/${item.id}/approve`, expect.anything());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(expect.objectContaining({ designSpec: correctedSpec }));
  });

  it("keeps an invalid DesignSpec draft out of the review item", async () => {
    render(<AdminReviewBoard />);

    await userEvent.click(screen.getAllByRole("button", { name: "编辑设计规范" })[0]);
    const editor = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "DesignSpec JSON" });
    fireEvent.change(editor, { target: { value: "{\"version\":\"broken\"}" } });
    await userEvent.click(screen.getByRole("button", { name: "保存设计规范修订" }));

    expect(screen.getByRole("alert")).toHaveTextContent("DesignSpec 格式无效");
    expect(screen.queryByText("设计规范已人工修订")).not.toBeInTheDocument();
  });

  it("keeps a review item visible when the moderation request loses the network", async () => {
    const artifact = createRemixArtifactFixture();
    const item: ReviewItem = {
      id: artifact.reference.siteId,
      jobId: "019fd13c-cb90-78b3-b99c-597458479aa4",
      submittedBy: "@lin",
      category: "SaaS",
      attempts: 1,
      artifactReviewed: false,
      site: { ...featuredSites[0], id: artifact.reference.siteId, remixArtifact: artifact, status: "in_review" },
    };
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    render(<AdminReviewBoard initialItems={[item]} />);
    await userEvent.click(screen.getByRole("button", { name: "检查复刻证据" }));
    await userEvent.click(screen.getByRole("button", { name: "确认已检查全部证据" }));

    await userEvent.click(screen.getByRole("button", { name: "通过" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("网络连接失败");
    expect(screen.getAllByText(item.site.title)).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "通过" })).toBeEnabled();
  });

  it("shows exhausted failed tasks with a retry action instead of approval controls", () => {
    const item: ReviewItem = {
      id: "019fd13c-cb90-78b3-b99c-597458479aa3",
      jobId: "019fd13c-cb90-78b3-b99c-597458479aa4",
      submittedBy: "@lin",
      category: "SaaS",
      attempts: 3,
      errorCode: "SCREENSHOT_UPLOAD_FAILED",
      artifactReviewed: false,
      site: { ...featuredSites[0], id: "019fd13c-cb90-78b3-b99c-597458479aa3", status: "failed" },
    };

    render(<AdminReviewBoard initialItems={[item]} />);

    expect(screen.getByText("处理失败")).toBeInTheDocument();
    expect(screen.getByText("SCREENSHOT_UPLOAD_FAILED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "通过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "驳回" })).not.toBeInTheDocument();
  });
});
