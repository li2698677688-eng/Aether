import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppLogo } from "@/components/app-logo";
import { CurrentCommunityNav, MobileCommunityMenu } from "@/components/community/community-nav";
import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";

export function CommunityShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-muted/25">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link aria-label="返回首页" className={buttonVariants({ size: "icon", variant: "ghost" })} href="/">
              <ArrowLeft aria-hidden="true" />
            </Link>
            <AppLogo />
          </div>
          <div className="flex items-center gap-1">
            <CurrentCommunityNav className="hidden md:flex" />
            <div className="md:hidden"><MobileCommunityMenu /></div>
            <ModeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}
