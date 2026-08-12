"use client";

import { Bookmark, ListChecks, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LazySheet = dynamic(() => import("@/components/ui/lazy-sheet").then((module) => module.LazySheet), { ssr: false });

export interface NavigationViewer {
  username: string;
  role: "user" | "admin";
  demo: boolean;
}

function communityItems(viewer: NavigationViewer | null) {
  const items = [{ href: "/me/favorites", label: "收藏", icon: Bookmark }];
  if (!viewer || viewer.demo) items.push({ href: "/login", label: "登录", icon: LogIn });
  if (viewer) {
    items.push(
      { href: "/me/submissions", label: "我的投稿", icon: ListChecks },
      { href: `/u/${viewer.username}`, label: "个人主页", icon: UserRound },
    );
    if (viewer.role === "admin") items.push({ href: "/admin/review", label: "审核后台", icon: ShieldCheck });
  }
  return items;
}

function isCurrentPath(pathname: string, href: string) {
  return href.startsWith("/u/") ? pathname === href : pathname === href;
}

export function CommunityNav({
  className,
  currentPath,
  onSignOut,
  stacked = false,
  viewer = null,
}: {
  className?: string;
  currentPath: string;
  onSignOut?: () => void;
  stacked?: boolean;
  viewer?: NavigationViewer | null;
}) {
  return (
    <nav aria-label="社区与账户" className={cn("flex items-center gap-1", stacked && "flex-col items-stretch", className)}>
      {communityItems(viewer).map((item) => {
        const current = isCurrentPath(currentPath, item.href);
        return (
          <Link
            aria-current={current ? "page" : undefined}
            className={cn(buttonVariants({ variant: current ? "default" : "ghost" }), stacked && "justify-start")}
            href={item.href}
            key={item.href}
          >
            <item.icon aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      {viewer && !viewer.demo && (
        <Button className={cn(stacked && "justify-start")} onClick={onSignOut} variant="ghost">
          <LogOut aria-hidden="true" />退出
        </Button>
      )}
    </nav>
  );
}

export function CurrentCommunityNav({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [viewer, setViewer] = useState<NavigationViewer | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/me", { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ viewer: NavigationViewer | null }> : null)
      .then((body) => {
        if (body && !controller.signal.aborted) setViewer(body.viewer);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function signOut() {
    const { createOptionalBrowserClient } = await import("@/lib/supabase/browser");
    const supabase = createOptionalBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setViewer(null);
    router.push("/");
    router.refresh();
  }

  return <CommunityNav className={className} currentPath={pathname} onSignOut={() => void signOut()} stacked={stacked} viewer={viewer} />;
}

export function MobileCommunityMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function updateOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <>
      <Button aria-expanded={open} aria-label="打开账户菜单" onClick={() => setOpen(true)} ref={triggerRef} size="icon" variant="ghost">
        <UserRound aria-hidden="true" />
      </Button>
      {open && <LazySheet className="w-[17rem] p-4" description="查看收藏、投稿、个人主页和管理员审核。" onOpenChange={updateOpen} open={open} side="right" title="账户与社区">
        <CurrentCommunityNav className="mt-6" stacked />
      </LazySheet>}
    </>
  );
}
