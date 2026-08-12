import { describe, expect, it, vi } from "vitest";

import { createAnalysisUploadTicketEntries } from "@/lib/analysis-upload-tickets";

describe("analysis upload tickets", () => {
  it("issues retry-safe signed uploads with upsert enabled", async () => {
    const createSignedUploadUrl = vi.fn(async (path: string) => ({
      data: { path, signedUrl: `https://storage.example/${path}`, token: "ticket" },
      error: null,
    }));
    const client = {
      storage: {
        from: vi.fn(() => ({ createSignedUploadUrl })),
      },
    };

    await expect(createAnalysisUploadTicketEntries(client, [
      { bucket: "private", key: "desktop", path: "site/job/desktop.webp" },
    ])).resolves.toEqual([["desktop", {
      path: "site/job/desktop.webp",
      signedUrl: "https://storage.example/site/job/desktop.webp",
      token: "ticket",
    }]]);
    expect(createSignedUploadUrl).toHaveBeenCalledWith("site/job/desktop.webp", { upsert: true });
  });

  it("fails the whole ticket batch when any storage ticket cannot be issued", async () => {
    const client = {
      storage: {
        from: () => ({
          createSignedUploadUrl: async () => ({ data: null, error: new Error("storage unavailable") }),
        }),
      },
    };

    await expect(createAnalysisUploadTicketEntries(client, [
      { bucket: "private", key: "desktop", path: "site/job/desktop.webp" },
    ])).rejects.toThrow("storage unavailable");
  });
});
