# Aether

[![Quality](https://github.com/li2698677688-eng/Aether/actions/workflows/quality.yml/badge.svg)](https://github.com/li2698677688-eng/Aether/actions/workflows/quality.yml)
[![CodeQL](https://github.com/li2698677688-eng/Aether/actions/workflows/codeql.yml/badge.svg)](https://github.com/li2698677688-eng/Aether/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/li2698677688-eng/Aether)](https://github.com/li2698677688-eng/Aether/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Aether is the open-source repository behind **DesignFeed**, a Chinese-first
community for discovering website design, inspecting reviewed evidence, and
turning a selected reference into a verified, runnable Remix artifact.

DesignFeed 的核心路径是：**发现 → 真实预览 → DesignSpec → 复刻**。访客无需登录
即可复制已经通过门禁的 Remix Launcher；没有完整证据或任一必测视口低于 90%
时，产品会明确拒绝交付。

- Live product: [designfeed-nine.vercel.app](https://designfeed-nine.vercel.app)
- Issues and roadmap: [GitHub Issues](https://github.com/li2698677688-eng/Aether/issues)
- Security reports: [Security policy](SECURITY.md)

> Aether is an early-stage maintainer-led project. Public GitHub metrics and
> releases are the source of truth; this README does not claim adoption that
> cannot be verified.

## What is included

- Responsive feed, search, categories, URL state, cursor pagination, favorites,
  submissions, profiles, and an administrator review queue.
- Real-site preview with an audited screenshot fallback and a visible original
  site exit.
- Versioned `DesignSpec 1.0` with evidence source and confidence on inferred
  design decisions.
- Versioned `RemixArtifact 2.0` with deterministic source, SHA-256 integrity,
  Render IR, source and clone screenshots, a runnable bundle, and quality gates.
- Supabase migrations and RLS, a Cloudflare Browser Rendering analyzer, and a
  pinned optional Remix Compiler image.
- HMAC callback verification, replay protection, URL and SSRF controls,
  private-object delivery, attempt-aware retries, security headers, CodeQL,
  Dependabot, and release checks.

The repository contains no captured third-party website images. Seed entries
use Aether-owned text-and-color placeholders. A configured private deployment
may render screenshots collected at runtime and approved through moderation;
those private objects are not part of the open-source history.

## Architecture

```text
Browser
  └─ Next.js application
       ├─ public discovery and Remix delivery routes
       ├─ Supabase Auth, Postgres, RLS, and private Storage
       └─ signed enqueue/callback boundary
            └─ Cloudflare Analyzer Worker
                 ├─ guarded Browser Rendering capture
                 ├─ structured DesignSpec generation
                 └─ pinned Remix Compiler
                      └─ verified bundle + four-view visual evidence
```

Every remote URL, DOM/CSS payload, model response, compiler result, callback,
and contribution is untrusted. Schema validation, authorization, origin-scoped
credentials, content hashes, moderation, and deterministic gates enforce the
boundary in code rather than relying on prompts.

Detailed boundaries are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
the compiler design is in [`docs/REMIX_COMPILER.md`](docs/REMIX_COMPILER.md).

## RemixArtifact 2.0 contract

A publishable artifact must include unique source and clone screenshots at
`375`, `768`, `1280`, and `1920` pixels. Each screenshot has a SHA-256 digest
and a site-scoped delivery URL. The worst mandatory viewport must reach at
least 90% visual similarity and all structural, layout, responsive, interaction,
asset, motion, pollution, capture, build, and determinism gates must pass.

`GET /api/remix/:siteId/clone/:width` signs a redirect only after the site and
artifact are authorized. An analyzer job may move from `analyzing` back to
`capturing` only for a strictly newer queue attempt; stale attempts are rejected
atomically by the database function.

## Local development

Requirements:

- Node.js 22.13.1 or newer
- pnpm 11.21.0
- Docker or OrbStack only when replaying the local Supabase stack

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. Without cloud credentials, development and tests
use a bounded local demo mode. Production never grants demo administration or
pretends that authentication, analysis, or Remix output succeeded.

The environment template documents all variables. The important trust
boundaries are:

- Supabase public URL/key versus server-only service-role access.
- Distinct 32+ character enqueue and callback secrets.
- A private screenshot bucket and a private Remix artifact bucket.
- A pinned compiler origin, API key, and 40–64 character source revision.
- A configured AI provider for `DesignSpec`; model output remains untrusted.

Never commit `.env.local`, credentials, local configuration, private reports,
or deployment identifiers.

## Quality and release gate

```bash
pnpm check
pnpm check:release
```

`pnpm check` runs 162+ tests, application and Worker type checks, zero-error
ESLint, the production build, and the 180 KiB gzip home-page JavaScript budget.
`pnpm check:release` additionally checks peer dependencies, type-checks the
Container wrapper, dry-runs the Analyzer Worker, and fails on high or critical
dependency advisories. The compiler container image itself is built in the
Docker-enabled Preview/release environment.

To replay every additive database migration from an empty local database:

```bash
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:stop
```

Deployment, health, Preview, production, and rollback checks are listed in
[`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md). A healthy deployment
must return HTTP 200 from `/api/health` with every reported check set to `true`.

## Repository map

```text
src/app/                 Next.js pages, Route Handlers, and auth callback
src/components/          shadcn/ui primitives and DesignFeed components
src/data/                redistributable seed metadata and DesignSpec fixtures
src/lib/                 schemas, repositories, security, and delivery logic
supabase/migrations/     additive Postgres, RLS, and Storage migrations
workers/analyzer/        guarded capture, extraction, queue, and retry Worker
services/remix-compiler/ pinned compiler image and Cloudflare container wrapper
```

UI changes must follow [`COMPONENT_USAGE.md`](COMPONENT_USAGE.md) and semantic
tokens in `src/app/globals.css`.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md), the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), and [`SECURITY.md`](SECURITY.md).
Bug reports and focused proposals are welcome. Please do not upload third-party
screenshots unless you can prove redistribution rights.

## License and attribution

Aether is licensed under the [Apache License 2.0](LICENSE). Its optional
compiler image fetches a pinned MIT-licensed upstream revision; attribution and
the full upstream notice are preserved in [`NOTICE`](NOTICE) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

DesignFeed and Aether are project names. Third-party product names in seed
metadata belong to their respective owners and do not imply endorsement.
