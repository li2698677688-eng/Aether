"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Something went wrong</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">页面暂时没有加载成功</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">你的操作没有丢失。可以重试当前页面，或先返回灵感 Feed。</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>重新加载</Button>
          <Button render={<Link href="/" />} variant="outline">返回首页</Button>
        </div>
      </div>
    </main>
  );
}
