import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityNav } from "@/components/community/community-nav";

describe("CommunityNav", () => {
  it("puts favorites and account destinations in one header navigation", () => {
    render(<CommunityNav currentPath="/" viewer={{ demo: true, role: "admin", username: "designfeed" }} />);

    expect(screen.getByRole("link", { name: "收藏" })).toHaveAttribute("href", "/me/favorites");
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "我的投稿" })).toHaveAttribute("href", "/me/submissions");
    expect(screen.getByRole("link", { name: "个人主页" })).toHaveAttribute("href", "/u/designfeed");
    expect(screen.getByRole("link", { name: "审核后台" })).toHaveAttribute("href", "/admin/review");
  });

  it("marks the current destination with the high-contrast selected state", () => {
    render(<CommunityNav currentPath="/login" viewer={{ demo: true, role: "admin", username: "designfeed" }} />);

    const login = screen.getByRole("link", { name: "登录" });
    expect(login).toHaveAttribute("aria-current", "page");
    expect(login).toHaveClass("bg-primary", "text-primary-foreground");
    expect(screen.getByRole("link", { name: "收藏" })).not.toHaveAttribute("aria-current");
  });

  it("shows a guest only public account destinations", () => {
    render(<CommunityNav currentPath="/" viewer={null} />);

    expect(screen.getByRole("link", { name: "收藏" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "我的投稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "审核后台" })).not.toBeInTheDocument();
  });

  it("uses the signed-in username and hides moderation from non-admin users", () => {
    render(<CommunityNav currentPath="/u/lin" viewer={{ demo: false, role: "user", username: "lin" }} />);

    expect(screen.getByRole("link", { name: "个人主页" })).toHaveAttribute("href", "/u/lin");
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "审核后台" })).not.toBeInTheDocument();
  });
});
