import { notFound } from "next/navigation";

import { CommunityShell } from "@/components/community/community-shell";
import { PublicSiteGrid } from "@/components/community/public-site-grid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicProfileData } from "@/lib/community-repository";

export const revalidate = 60;

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getPublicProfileData(username);
  if (!profile) notFound();
  return (
    <CommunityShell>
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          {profile.avatarUrl && <AvatarImage alt="" src={profile.avatarUrl} />}
          <AvatarFallback>{profile.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">{profile.displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">@{profile.username} · 已审核通过的公开投稿 {profile.sites.length}</p>
        </div>
      </div>
      {profile.sites.length ? <PublicSiteGrid sites={profile.sites} /> : (
        <div className="mt-8 rounded-xl border bg-background p-12 text-center text-sm text-muted-foreground">还没有审核通过的公开投稿。</div>
      )}
    </CommunityShell>
  );
}
