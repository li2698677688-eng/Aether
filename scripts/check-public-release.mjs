import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const contentRules = [
  ["Vercel deployment identifier", /\bdpl_[A-Za-z0-9]{12,}\b/],
  ["private application email", /\bli2698677688@gmail\.com\b/i],
  ["OpenAI organization identifier", /\borg-[A-Za-z0-9_-]{8,}\b/],
  ["credential-like value", /\b(?:gh[opsu]_|sk-(?:proj-)?|xox[baprs]-|sbp_|vercel_)[A-Za-z0-9_-]{20,}\b/],
  ["private key material", /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/],
];

function isForbiddenPath(path) {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  const basename = normalized.split("/").at(-1) ?? normalized;
  return normalized.startsWith(".private/")
    || normalized.startsWith("design-reference/")
    || normalized.startsWith("书籍/")
    || normalized.startsWith("public/covers/")
    || normalized.toLowerCase().includes("codex-for-oss")
    || basename === "Codex_复利与踩坑日志.md"
    || basename === ".dev.vars"
    || (basename.startsWith(".env") && basename !== ".env.example");
}

export function findForbiddenPaths(paths) {
  return paths.filter(isForbiddenPath);
}

export function findForbiddenContent(content) {
  return contentRules.flatMap(([label, pattern]) => pattern.test(content) ? [label] : []);
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
}

function trackedText(paths) {
  const chunks = [];
  for (const path of paths) {
    const absolutePath = resolve(process.cwd(), path);
    const stats = statSync(absolutePath);
    if (stats.size > 10 * 1024 * 1024) continue;
    const bytes = readFileSync(absolutePath);
    if (bytes.subarray(0, 8_192).includes(0)) continue;
    chunks.push(bytes.toString("utf8"));
  }
  return chunks.join("\n");
}

export function checkPublicRelease({ history = false } = {}) {
  const trackedPaths = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const candidatePaths = [...trackedPaths];
  let content = trackedText(trackedPaths);

  if (history) {
    const objects = git(["rev-list", "--objects", "--all"]);
    candidatePaths.push(...objects.split("\n").flatMap((line) => {
      const separator = line.indexOf(" ");
      return separator === -1 ? [] : [line.slice(separator + 1)];
    }));
    content += git(["log", "--all", "--format=", "--patch", "--no-ext-diff", "--no-textconv"]);
  }

  return {
    content: findForbiddenContent(content),
    paths: [...new Set(findForbiddenPaths(candidatePaths))].sort(),
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const findings = checkPublicRelease({ history: process.argv.includes("--history") });
  if (findings.paths.length || findings.content.length) {
    console.error("Public release scan failed.");
    if (findings.paths.length) console.error(`Forbidden paths:\n- ${findings.paths.join("\n- ")}`);
    if (findings.content.length) console.error(`Forbidden content:\n- ${findings.content.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Public release scan passed${process.argv.includes("--history") ? " for the current tree and reachable history" : " for the current tree"}.`);
  }
}
