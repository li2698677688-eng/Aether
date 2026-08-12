import { gzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const BUILD_DIR = resolve(".next");
const MANIFEST_PATH = resolve(BUILD_DIR, "server/app/page_client-reference-manifest.js");
const HOME_ENTRY = "[project]/src/app/page";
const BUDGET_BYTES = 180 * 1024;

if (!existsSync(MANIFEST_PATH)) {
  console.error("Performance budget check requires a completed Next.js build.");
  process.exit(1);
}

await import(`${pathToFileURL(MANIFEST_PATH).href}?budget=${Date.now()}`);
const manifest = globalThis.__RSC_MANIFEST?.["/page"];
const files = [...new Set(manifest?.entryJSFiles?.[HOME_ENTRY] ?? [])];
if (!files.length) {
  console.error("Could not resolve the DesignFeed home-page client chunks.");
  process.exit(1);
}

const gzipBytes = files.reduce((total, file) => {
  const source = readFileSync(resolve(BUILD_DIR, file));
  return total + gzipSync(source).byteLength;
}, 0);
const formattedSize = (gzipBytes / 1024).toFixed(1);

console.log(`Home initial JavaScript: ${formattedSize} KiB gzip (${files.length} chunks; budget 180 KiB).`);
if (gzipBytes > BUDGET_BYTES) {
  console.error("Home initial JavaScript exceeds the DesignFeed release budget.");
  process.exit(1);
}
