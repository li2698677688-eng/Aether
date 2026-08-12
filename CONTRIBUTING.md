# Contributing to Aether

Thank you for helping improve DesignFeed's open-source foundation. Small,
focused changes with evidence are easiest to review.

## Before opening a change

1. Search existing issues and open a proposal before a large architectural,
   data-contract, authentication, or deployment change.
2. Never submit a third-party website screenshot, private report, credential,
   deployment identifier, or content whose redistribution rights are unclear.
3. Read [`COMPONENT_USAGE.md`](COMPONENT_USAGE.md) before changing UI and
   [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing trust
   boundaries.
4. Database changes must add a new migration. Never rewrite a published
   migration.

## Development setup

Use Node.js 22.13.1 or newer and pnpm 11.21.0.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

The application has a local demo mode. Never add fake production success
states for authentication, moderation, screenshot delivery, or Remix output.

## Pull request gate

Add or update a failing test before behavior changes, then run:

```bash
pnpm check:release
```

The gate covers unit tests, application and Worker types, ESLint, production
build, the 180 KiB home-page JavaScript budget, Worker dry-runs, peer
dependencies, and high/critical dependency advisories.

Describe the user outcome, risk, tests run, screenshots for visible changes,
and any unverified external service. A maintainer must review security-sensitive
changes and every Remix artifact contract change.

By contributing, you agree that your contribution is licensed under the
Apache License 2.0 in [`LICENSE`](LICENSE).
