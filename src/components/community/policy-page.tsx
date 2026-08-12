import { CommunityShell } from "@/components/community/community-shell";

export interface PolicySection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export function PolicyPage({
  eyebrow,
  intro,
  sections,
  title,
}: {
  eyebrow: string;
  intro: string;
  sections: PolicySection[];
  title: string;
}) {
  return (
    <CommunityShell>
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">{intro}</p>
        <p className="mt-3 text-xs text-muted-foreground">最后更新：2026 年 8 月 5 日</p>
        <div className="mt-10 space-y-8 border-t pt-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold tracking-[-0.02em]">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.bullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </CommunityShell>
  );
}
