import { CommunityShell } from "@/components/community/community-shell";
import { FavoriteGrid } from "@/components/community/favorite-grid";
import { requireViewer } from "@/lib/auth";
import { getFavoriteCollection } from "@/lib/community-repository";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const viewer = await requireViewer("/me/favorites");
  const collection = await getFavoriteCollection(viewer);
  return (
    <CommunityShell>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Private collection</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">我的收藏</h1>
      <p className="mb-8 mt-3 text-sm text-muted-foreground">收藏仅本人可见。</p>
      <FavoriteGrid initialFavorites={collection.initialIds} sites={collection.sites} />
    </CommunityShell>
  );
}
