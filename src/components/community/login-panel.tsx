"use client";

import { CheckCircle2, LoaderCircle, LogIn, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { safeNextPath } from "@/lib/auth-path";
import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import { createOptionalBrowserClient } from "@/lib/supabase/browser";
import { isGoogleAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";

const LOGIN_LINK_RESEND_DELAY_MS = 60_000;

export function LoginPanel({
  authError = false,
  demoAllowed = isLocalDemoAllowed(),
  googleEnabled = isGoogleAuthEnabled(),
  nextPath = "/",
}: {
  authError?: boolean;
  demoAllowed?: boolean;
  googleEnabled?: boolean;
  nextPath?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [message, setMessage] = useState(authError ? "登录链接无效或已过期，请重新发送。" : "");
  const [isError, setIsError] = useState(authError);
  const [pending, setPending] = useState(false);
  const safeDestination = safeNextPath(nextPath);
  const authUnavailable = !demoAllowed && !isSupabaseConfigured();

  useEffect(() => {
    if (!linkSent || canResend) return;
    const timeout = window.setTimeout(() => setCanResend(true), LOGIN_LINK_RESEND_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [canResend, linkSent]);

  function callbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeDestination)}`;
  }

  async function requestLoginLink() {
    if (authUnavailable) return;
    setPending(true);
    setMessage("");
    setIsError(false);
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    try {
      const supabase = createOptionalBrowserClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: callbackUrl(),
            shouldCreateUser: true,
          },
        });
        if (error) {
          setIsError(true);
          setMessage("登录邮件发送失败，请稍后重试。");
        } else {
          setLinkSent(true);
          setCanResend(false);
        }
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        setLinkSent(true);
        setCanResend(false);
      }
    } catch {
      setIsError(true);
      setMessage("网络连接失败，请稍后重新发送登录链接。");
    } finally {
      setPending(false);
    }
  }

  async function sendLoginLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestLoginLink();
  }

  async function signInWithGoogle() {
    if (authUnavailable) return;
    setPending(true);
    setMessage("");
    setIsError(false);
    try {
      const supabase = createOptionalBrowserClient();
      if (!supabase) {
        router.push(safeDestination);
        router.refresh();
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl() },
      });
      if (error) {
        setIsError(true);
        setMessage("Google 登录暂时不可用，请使用邮件登录。");
      }
    } catch {
      setIsError(true);
      setMessage("网络连接失败，请使用邮件登录或稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-none">
      <CardHeader>
        <h1 className="text-base font-medium leading-snug">登录 DesignFeed</h1>
        <p className="text-sm leading-6 text-muted-foreground">登录后可以投稿、查看处理状态并管理私人收藏。</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {authUnavailable && (
          <Alert variant="destructive">
            <LogIn aria-hidden="true" />
            <AlertTitle>登录服务尚未配置</AlertTitle>
            <AlertDescription>当前环境未连接认证服务，请稍后再试。</AlertDescription>
          </Alert>
        )}
        {!linkSent ? (
          <>
            {googleEnabled && (
              <>
                <Button className="h-10 w-full" disabled={pending || authUnavailable} onClick={signInWithGoogle} variant="outline">
                  <LogIn aria-hidden="true" /> 使用 Google 继续
                </Button>
                <div className="flex items-center gap-3"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">或使用邮箱</span><Separator className="flex-1" /></div>
              </>
            )}
            <form className="space-y-3" onSubmit={sendLoginLink}>
              <label className="text-sm font-medium" htmlFor="email">邮箱</label>
              <Input
                autoComplete="email"
                className="h-10"
                disabled={authUnavailable}
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              <Button className="h-10 w-full" disabled={pending || authUnavailable} type="submit">
                {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Mail aria-hidden="true" />}
                {pending ? "发送中" : "发送登录链接"}
              </Button>
            </form>
          </>
        ) : (
          <section aria-labelledby="email-link-sent" className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{email}</p>
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-medium" id="email-link-sent">登录链接已发送</h2>
              <p className="text-sm leading-6 text-muted-foreground">请打开邮件并点击其中的登录链接。无需返回本页输入验证码。</p>
              <p className="text-xs leading-5 text-muted-foreground">链接只能使用一次；如果没有收到，请检查垃圾邮件。</p>
            </div>
            {demoAllowed && !isSupabaseConfigured() && (
              <Button className="h-10 w-full" onClick={() => { router.push(safeDestination); router.refresh(); }} type="button">
                本地演示：继续
              </Button>
            )}
            <Button className="h-10 w-full" disabled={pending || !canResend} onClick={requestLoginLink} type="button" variant="outline">
              {pending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {pending ? "重新发送中" : canResend ? "重新发送登录链接" : "60 秒后可重新发送"}
            </Button>
            <Button className="h-9 w-full" disabled={pending} onClick={() => { setLinkSent(false); setCanResend(false); setMessage(""); setIsError(false); }} type="button" variant="ghost">
              更换邮箱
            </Button>
          </section>
        )}
        {message && (
          <Alert variant={isError ? "destructive" : "default"}><CheckCircle2 aria-hidden="true" /><AlertTitle>{isError ? "操作失败" : "操作完成"}</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>
        )}
        <p className="text-center text-xs leading-5 text-muted-foreground">继续即表示同意 <Link className="underline underline-offset-4" href="/policies/submissions">投稿规则</Link> 与 <Link className="underline underline-offset-4" href="/policies/privacy">隐私说明</Link>。</p>
      </CardContent>
    </Card>
  );
}
