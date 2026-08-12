import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFavorites } from "@/hooks/use-favorites";

const mocks = vi.hoisted(() => ({ configured: false }));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => mocks.configured,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function Harness({ initialFavorites = [] }: { initialFavorites?: string[] }) {
  const { favorites, toggleFavorite } = useFavorites(initialFavorites);
  return (
    <div>
      <span>{favorites.has("site-01") ? "已收藏" : "未收藏"}</span>
      <button onClick={() => toggleFavorite("site-01")} type="button">切换</button>
    </div>
  );
}

beforeEach(() => {
  mocks.configured = false;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("useFavorites", () => {
  it("recovers from malformed local storage and keeps the demo collection usable", async () => {
    window.localStorage.setItem("designfeed:favorites", "not-json");
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "切换" }));
    expect(screen.getByText("已收藏")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("designfeed:favorites") ?? "[]")).toEqual(["site-01"]);
  });

  it("hydrates private favorites from the API and persists an optimistic removal", async () => {
    mocks.configured = true;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ids: ["site-01"] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<Harness initialFavorites={["site-01"]} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/me/favorites", expect.any(Object)));
    await userEvent.click(screen.getByRole("button", { name: "切换" }));

    expect(screen.getByText("未收藏")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/sites/site-01/favorite", expect.objectContaining({ method: "DELETE" }));
  });
});
