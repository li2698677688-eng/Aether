-- The compiler process can disappear after a job completes. Persist both sides
-- of every visual comparison so moderation never has to trust a numeric score
-- without durable evidence.
alter table public.sites drop constraint if exists sites_remix_clone_screenshot_gate;
alter table public.sites add constraint sites_remix_clone_screenshot_gate check (
  remix_artifact is null or (
    jsonb_typeof(remix_artifact #> '{evidence,cloneScreenshots}') = 'array'
    and jsonb_array_length(remix_artifact #> '{evidence,cloneScreenshots}') >= 4
    and jsonb_path_exists(remix_artifact, '$.evidence.cloneScreenshots[*] ? (@.width == 375)')
    and jsonb_path_exists(remix_artifact, '$.evidence.cloneScreenshots[*] ? (@.width == 768)')
    and jsonb_path_exists(remix_artifact, '$.evidence.cloneScreenshots[*] ? (@.width == 1280)')
    and jsonb_path_exists(remix_artifact, '$.evidence.cloneScreenshots[*] ? (@.width == 1920)')
  )
);

comment on constraint sites_remix_clone_screenshot_gate on public.sites is
  'A Remix artifact must retain compiler-result screenshots at all four mandatory viewports; a score without both visual sides is not publishable evidence.';
