import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubmissionList } from "@/components/community/submission-list";
import type { SubmissionItem } from "@/lib/community-repository";

const queuedJob: SubmissionItem = {
  id: "job-1",
  siteId: "site-1",
  slug: "example",
  title: "example.com",
  url: "https://example.com/",
  status: "queued",
  attempts: 0,
  createdAt: "2026-08-05T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SubmissionList live status", () => {
  it("refreshes active jobs and stops polling after a terminal status", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...queuedJob, status: "published", attempts: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SubmissionList initialJobs={[queuedJob]} />);
    expect(screen.getByText("等待采集")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(fetchMock).toHaveBeenCalledWith("/api/submissions/job-1/status", expect.objectContaining({ cache: "no-store" }));
    expect(screen.getByText("已发布")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(16_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
