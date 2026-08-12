import { cn } from "@/lib/utils";
import type { Site } from "@/types/site";

const arrangements = [
  "items-start text-left",
  "items-end text-right",
  "items-center text-center",
] as const;

function arrangementFor(slug: string) {
  const score = Array.from(slug).reduce((total, character) => total + character.charCodeAt(0), 0);
  return arrangements[score % arrangements.length];
}

export function SiteCoverPlaceholder({
  className,
  site,
}: {
  className?: string;
  site: Pick<Site, "category" | "slug" | "title">;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 flex flex-col justify-between overflow-hidden bg-background p-5 text-foreground",
        arrangementFor(site.slug),
        className,
      )}
      data-placeholder="designfeed-owned"
    >
      <div className="flex w-full items-center justify-between border-b pb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>DesignFeed</span>
        <span>{site.category}</span>
      </div>
      <div className="flex w-full flex-1 items-center py-5">
        <p className="max-w-[82%] text-3xl font-semibold leading-none tracking-[-0.06em] sm:text-4xl">
          {site.title}
        </p>
      </div>
      <div className="flex w-full items-end justify-between gap-4 border-t pt-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Open source preview
        </span>
        <span className="size-5 shrink-0 bg-primary" />
      </div>
    </div>
  );
}
