# DesignFeed Remix Compiler service

This directory makes the deterministic compiler behind Remix reproducible. It
does not copy a floating branch: the image fetches and verifies the audited
`ion-design/ditto.site` revision
`3860a1a3a340069eabbfc550fd49807dd10f4f2c`, then applies the small dependency
security patch tracked beside the Dockerfile.

## What runs

The default image starts the upstream API in its single-process queue mode. A
clone request returns `202`, runs Playwright capture and verification in the
background, and remains available through the same REST contract used by
`src/lib/remix-compiler.ts`:

```text
POST /v1/clones
GET  /v1/clones/:jobId
GET  /v1/clones/:jobId/result
GET  /v1/clones/:jobId/bundle?format=tgz
GET  /v1/clones/:jobId/app-preview/*
```

All `/v1/*` routes are private when `API_KEYS` is set. Production must use a
random key of at least 32 characters and HTTPS in front of the service. The
health check is intentionally public at `/healthz`.

## Local image

```bash
docker build --platform linux/amd64 -t designfeed-remix-compiler services/remix-compiler
docker run --rm -p 8787:8787 \
  -e API_KEYS='<random-32+-character-key>' \
  designfeed-remix-compiler
```

Then set `REMIX_COMPILER_URL=http://127.0.0.1:8787` and the same API key in a
local analyzer environment. Remote environments require HTTPS.

## Cloudflare Containers

The `cloudflare/` directory pins all requests to one named Container instance,
which is required because job state is held in that process while a clone runs.
It uses a 6 GiB / 1 vCPU `standard-2` instance and never scales beyond one
instance. Before deployment:

1. Enable the Workers Paid plan (Containers are unavailable on Free).
2. Ensure Docker can build `linux/amd64` images.
3. Run `pnpm install` inside `cloudflare/`.
4. Store the same 32+ character key with
   `pnpm wrangler secret put REMIX_COMPILER_API_KEY`.
5. Run `pnpm deploy`.

Do not deploy the container without `REMIX_COMPILER_API_KEY`; the upstream API
would otherwise be public. The initial container mode is intentionally limited
to one active job and loses unfinished jobs if the container is restarted.
Before a public high-volume launch, switch to the upstream two-service
Postgres/pg-boss + R2 deployment described in `docs/REMIX_COMPILER.md`.

## Security and upgrade gate

The patch upgrades Hono, its Node adapter, MCP SDK, `fast-uri`, and
`ip-address`. The last two close URL/host parsing issues relevant to SSRF. The
patched revision was verified with:

```bash
npm run typecheck
npm run test --workspaces --if-present
npm audit --omit=dev
```

Any compiler revision or dependency change must rerun those checks and the
Sivers, Supabase and GOV.UK real-site benchmarks in `docs/REMIX_COMPILER.md`.
