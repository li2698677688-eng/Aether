import { CommunityShell } from "@/components/community/community-shell";
import { LoginPanel } from "@/components/community/login-panel";
import { safeNextPath } from "@/lib/auth-path";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[]; next?: string | string[] }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  return (
    <CommunityShell>
      <div className="flex min-h-[calc(100svh-10rem)] items-center justify-center">
        <LoginPanel authError={error === "callback"} nextPath={nextPath} />
      </div>
    </CommunityShell>
  );
}
