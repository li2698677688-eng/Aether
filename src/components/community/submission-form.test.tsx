import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubmissionForm } from "@/components/community/submission-form";

afterEach(() => vi.restoreAllMocks());

describe("SubmissionForm failures", () => {
  it("recovers from an unavailable submission endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    render(<SubmissionForm />);

    await userEvent.type(screen.getByLabelText("网站地址"), "https://example.com");
    await userEvent.click(screen.getByRole("button", { name: "提交网站" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("网络连接失败");
    expect(screen.getByRole("button", { name: "提交网站" })).toBeEnabled();
    expect(screen.getByLabelText("网站地址")).toHaveValue("https://example.com");
  });
});
