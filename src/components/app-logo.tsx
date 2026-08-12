import { PanelsTopLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function AppLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      aria-label="返回 DesignFeed 首页"
      className={cn("inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em]", className)}
      href="/"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
        <PanelsTopLeft aria-hidden="true" className="size-4" strokeWidth={2.2} />
      </span>
      {!compact && <span className="text-[15px]">DesignFeed</span>}
    </Link>
  );
}
