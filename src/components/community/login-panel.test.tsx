import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPanel } from "@/components/community/login-panel";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createOptionalBrowserClient: () => ({
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithOtp: mocks.signInWithOtp,
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
});

describe("LoginPanel email verification", () => {
  it("shows an actionable error when an OAuth callback could not create a session", () => {
    render(<LoginPanel authError nextPath="/submit" />);

    expect(screen.getByRole("alert")).toHaveTextContent("登录链接无效或已过期，请重新发送");
  });

  it("sends one clear email sign-in link without presenting a code field", async () => {
    render(<LoginPanel nextPath="/me/submissions" />);

    expect(screen.getByRole("heading", { level: 1, name: "登录 DesignFeed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "投稿规则" })).toHaveAttribute("href", "/policies/submissions");
    expect(screen.getByRole("link", { name: "隐私说明" })).toHaveAttribute("href", "/policies/privacy");

    await userEvent.type(screen.getByLabelText("邮箱"), "lin@example.com");
    expect(screen.queryByRole("button", { name: "使用 Google 继续" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "发送登录链接" }));
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "lin@example.com",
      options: {
        emailRedirectTo: expect.stringContaining("/auth/callback?next=%2Fme%2Fsubmissions"),
        shouldCreateUser: true,
      },
    });

    expect(screen.getByRole("heading", { level: 2, name: "登录链接已发送" })).toBeInTheDocument();
    expect(screen.getByText("lin@example.com")).toBeInTheDocument();
    expect(screen.getByText("请打开邮件并点击其中的登录链接。无需返回本页输入验证码。" )).toBeInTheDocument();
    expect(screen.queryByLabelText("邮箱验证码")).not.toBeInTheDocument();
  });

  it("protects resend behind a cooldown and lets users change the destination email", async () => {
    render(<LoginPanel nextPath="/me/submissions" />);

    await userEvent.type(screen.getByLabelText("邮箱"), "lin@example.com");
    await userEvent.click(screen.getByRole("button", { name: "发送登录链接" }));
    expect(screen.getByRole("button", { name: "60 秒后可重新发送" })).toBeDisabled();
    expect(mocks.signInWithOtp).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "更换邮箱" }));
    expect(screen.getByLabelText("邮箱")).toHaveValue("lin@example.com");
  });

  it("keeps the email form visible when Supabase cannot send the link", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { message: "rate limited" } });
    render(<LoginPanel nextPath="/me/submissions" />);

    await userEvent.type(screen.getByLabelText("邮箱"), "lin@example.com");
    await userEvent.click(screen.getByRole("button", { name: "发送登录链接" }));

    expect(screen.getByText("登录邮件发送失败，请稍后重试。" )).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toHaveValue("lin@example.com");
  });

  it("shows an actionable error when Google sign-in cannot start", async () => {
    mocks.signInWithOAuth.mockResolvedValue({ error: { message: "provider disabled" } });
    render(<LoginPanel googleEnabled />);

    await userEvent.click(screen.getByRole("button", { name: "使用 Google 继续" }));

    expect(await screen.findByText("Google 登录暂时不可用，请使用邮件登录。" )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用 Google 继续" })).toBeEnabled();
  });

  it("does not offer a demo administrator when production auth is unavailable", () => {
    render(<LoginPanel demoAllowed={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent("登录服务尚未配置");
    expect(screen.getByRole("button", { name: "发送登录链接" })).toBeDisabled();
  });
});
