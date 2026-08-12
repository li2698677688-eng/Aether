import { describe, expect, it } from "vitest";

import { findForbiddenContent, findForbiddenPaths } from "./check-public-release.mjs";

describe("public release policy", () => {
  it("rejects private artifacts and unlicensed cover paths while allowing the environment template", () => {
    expect(findForbiddenPaths([
      ".env.example",
      ".env.local",
      ".private/codex-for-oss/application.md",
      "Codex_复利与踩坑日志.md",
      "design-reference/vechooool-home-desktop.jpg",
      "public/covers/example.jpg",
      "src/app/page.tsx",
      "书籍/notes.md",
    ])).toEqual([
      ".env.local",
      ".private/codex-for-oss/application.md",
      "Codex_复利与踩坑日志.md",
      "design-reference/vechooool-home-desktop.jpg",
      "public/covers/example.jpg",
      "书籍/notes.md",
    ]);
  });

  it("rejects deployment identifiers, application identity, credentials, and private keys", () => {
    const findings = findForbiddenContent([
      `preview ${"dpl_"}${"6qiwK1e2UFMEvtxyovpsndLSmHSU"}`,
      `email ${"li2698677688"}${"@gmail.com"}`,
      `token ${"gho_"}${"1234567890abcdefghijklmnop"}`,
      `${"-----BEGIN "}${"PRIVATE KEY-----"}`,
    ].join("\n"));

    expect(findings).toEqual([
      "Vercel deployment identifier",
      "private application email",
      "credential-like value",
      "private key material",
    ]);
  });

  it("allows documented placeholders and public product URLs", () => {
    expect(findForbiddenContent([
      "secret-compiler-key",
      "https://designfeed-nine.vercel.app",
      "REMIX_COMPILER_API_KEY",
    ].join("\n"))).toEqual([]);
  });
});
