import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("analysis job event migration", () => {
  it("records every meaningful stage change with timing, attempts and errors under RLS", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608050005_analysis_job_events.sql"),
      "utf8",
    );

    expect(migration).toContain("create table public.analysis_job_events");
    expect(migration).toContain("stage_duration_ms");
    expect(migration).toContain("attempts");
    expect(migration).toContain("error_code");
    expect(migration).toContain("create trigger jobs_log_stage_update");
    expect(migration).toContain("is not distinct from");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("users read events for own sites");
  });
});

describe("moderation transaction migration", () => {
  it("updates the site, analysis job, and audit log in one locked transaction", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608050006_atomic_moderation.sql"),
      "utf8",
    );

    expect(migration).toContain("create or replace function public.review_site");
    expect(migration).toContain("for update");
    expect(migration).toContain("update public.sites");
    expect(migration).toContain("update public.analysis_jobs");
    expect(migration).toContain("insert into public.moderation_logs");
    expect(migration).toContain("grant execute on function public.review_site");
    expect(migration).toContain("create or replace function public.retry_site_analysis");
    expect(migration).toContain("create or replace function public.fail_analysis_retry");
  });
});

describe("submission concurrency migration", () => {
  it("serializes per-user limit checks and atomically marks enqueue failures", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608050007_submission_concurrency.sql"),
      "utf8",
    );

    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("create or replace function public.fail_submission_enqueue");
    expect(migration).toContain("for update");
    expect(migration).toContain("update public.sites");
    expect(migration).toContain("update public.analysis_jobs");
  });
});

describe("API privilege migration", () => {
  it("exposes only RLS-protected application tables to API roles", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608050008_api_privileges.sql"),
      "utf8",
    );

    expect(migration).toContain("grant usage on schema public to anon, authenticated, service_role");
    expect(migration).toContain("grant select (id, username, display_name, avatar_url) on public.profiles to anon");
    expect(migration).toContain("grant select on public.sites to authenticated");
    expect(migration).toContain("grant select, insert, update, delete on public.favorites to authenticated");
    expect(migration).toContain("create policy \"users update own favorites\"");
    expect(migration).toContain("grant all privileges on all tables in schema public to service_role");
    expect(migration).toContain("revoke all on public.webhook_events from anon, authenticated");
  });
});

describe("RemixArtifact 2.0 migration", () => {
  it("stores private compiler artifacts and refuses to publish an unverified clone", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608060001_remix_artifact_v2.sql"),
      "utf8",
    );

    expect(migration).toContain("remix_artifacts_private");
    expect(migration).toContain("add column if not exists remix_artifact jsonb");
    expect(migration).toContain("add column if not exists remix_bundle_path text");
    expect(migration).toContain("add column if not exists remix_evidence_path text");
    expect(migration).toContain("p_patch ? 'remixArtifact'");
    expect(migration).toContain("quality,status");
    expect(migration).toContain("worstVisualSimilarity");
    expect(migration).toContain("REMIX_ARTIFACT_QUALITY_REQUIRED");
    expect(migration).toContain("grant select (remix_artifact) on public.sites to anon");
  });

  it("replaces legacy prompt approval with evidence-backed artifact moderation", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608060002_remix_artifact_moderation.sql"),
      "utf8",
    );

    expect(migration).toContain("create or replace function public.review_site");
    expect(migration).toContain("REMIX_ARTIFACT_QUALITY_REQUIRED");
    expect(migration).toContain("remix_artifact #>> '{quality,status}' <> 'passed'");
    expect(migration).toContain("jsonb_each_text(case");
    expect(migration).toContain("jsonb_typeof(v_site.remix_artifact #> '{quality,gates}') is distinct from 'object'");
    expect(migration).toContain("select count(*) into v_gate_count");
    expect(migration).toContain("from jsonb_object_keys(case");
    expect(migration).toContain("or v_gate_count <> 11");
    expect(migration).toContain("jsonb_array_elements(v_site.remix_artifact #> '{evidence,sourceScreenshots}')");
    expect(migration).toContain("unnest(string_to_array(v_site.remix_bundle_path, '/'))");
    expect(migration).toContain("unnest(string_to_array(v_site.remix_evidence_path, '/'))");
    expect(migration).toContain("before update of status, remix_artifact, remix_bundle_path, remix_evidence_path, remix_compiler_job_id");
    expect(migration).toContain("remixArtifactReviewed");
    expect(migration).not.toContain("REMIX_PROMPT_REQUIRED");
  });

  it("requires durable compiler-result screenshots before an artifact can be stored", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608060003_remix_clone_screenshot_gate.sql"),
      "utf8",
    );

    expect(migration).toContain("sites_remix_clone_screenshot_gate");
    for (const width of [375, 768, 1280, 1920]) {
      expect(migration).toContain(`@.width == ${width}`);
    }
  });

  it("allows a newer queue attempt to restart capture after a crashed analysis stage", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202608060004_analysis_attempt_restart.sql"),
      "utf8",
    );

    expect(migration).toContain("create or replace function public.apply_analysis_callback");
    expect(migration).toContain("p_attempts > v_job.attempts");
    expect(migration).toMatch(/v_job\.status = 'analyzing'\s+and p_status = 'capturing'/);
    expect(migration).toContain("p_attempts < v_job.attempts");
    expect(migration).toContain("return 'stale_attempt'");
  });
});
