"use client";

import { CheckCircle2, Globe2, LoaderCircle, ScanSearch, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface SubmissionResponse {
  id: string;
  normalizedUrl: string;
  status: "queued" | "failed";
  warning?: string;
}

export function SubmissionForm() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/submissions", {
        body: JSON.stringify({ url }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = await response.json().catch(() => null) as (SubmissionResponse & { error?: string }) | null;
      if (!response.ok || !body) {
        setError(body?.error ?? "提交失败，请稍后重试");
        return;
      }
      setResult(body);
    } catch {
      setError("网络连接失败，请检查连接后重试。");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <Card className="shadow-none">
        <CardHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 aria-hidden="true" />
          </span>
          <CardTitle>{result.status === "queued" ? "已进入采集队列" : "投稿已保存"}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{result.status === "queued" ? "页面会在后台完成截图、分析与人工审核，不需要停留等待。" : "采集暂时没有启动，管理员可以在任务记录中重新尝试。"}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="truncate text-sm font-medium">{result.normalizedUrl}</p>
            <p className="mt-1 text-xs text-muted-foreground">任务编号 {result.id}</p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs"><span>{result.status === "queued" ? "等待采集" : "等待重试"}</span><span className="text-muted-foreground">{result.status === "queued" ? "10%" : "0%"}</span></div>
            <Progress value={result.status === "queued" ? 10 : 0} />
          </div>
          {result.warning && <Alert variant="destructive"><AlertTitle>采集尚未启动</AlertTitle><AlertDescription>{result.warning}</AlertDescription></Alert>}
          <Button className="w-full" render={<Link href="/me/submissions" />} variant="default">查看我的投稿</Button>
          <Button className="w-full" onClick={() => setResult(null)} variant="outline">继续投稿</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>提交公开网站 URL</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">每天最多 3 个；只有管理员审核通过后，网站才会出现在公开 Feed。</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <label className="text-sm font-medium" htmlFor="submission-url">网站地址</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              autoComplete="url"
              className="h-10"
              id="submission-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              required
              type="url"
              value={url}
            />
            <Button className="h-10 sm:w-32" disabled={pending} type="submit">
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Globe2 aria-hidden="true" />}
              {pending ? "校验中" : "提交网站"}
            </Button>
          </div>
          {error && <Alert variant="destructive"><AlertTitle>无法提交</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        </form>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Globe2, title: "安全采集", text: "校验地址并拦截私网目标" },
            { icon: ScanSearch, title: "结构分析", text: "提取视觉 Token 与组件" },
            { icon: ShieldCheck, title: "人工审核", text: "确认内容和推断边界" },
          ].map((item) => (
            <div className="rounded-lg border p-3" key={item.title}>
              <item.icon aria-hidden="true" className="size-4" />
              <p className="mt-3 text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">提交即表示你已阅读 <Link className="underline underline-offset-4" href="/policies/submissions">投稿规则</Link>；权利人可以随时申请下架。</p>
      </CardContent>
    </Card>
  );
}
