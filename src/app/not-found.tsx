import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">没有找到这个灵感页面</h1>
        <p className="mt-3 text-sm text-muted-foreground">它可能尚未通过审核，或已经应权利人要求下架。</p>
        <Link className={`${buttonVariants()} mt-6`} href="/">返回首页</Link>
      </div>
    </main>
  );
}
