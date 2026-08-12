import { Skeleton } from "@/components/ui/skeleton";

export default function GlobalLoading() {
  return (
    <main aria-busy="true" aria-label="页面加载中" className="mx-auto grid min-h-svh max-w-6xl content-start gap-4 px-4 py-16">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-12 max-w-xl" />
      <Skeleton className="h-72 w-full" />
      <span className="sr-only">页面加载中</span>
    </main>
  );
}
