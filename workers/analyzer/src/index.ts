import puppeteer, { type HTTPRequest, type Page } from "@cloudflare/puppeteer";

import { appRequestHeaders, assertCompleteRenderEvidence, authorizedRequestHeaders, clampFullPageHeight, createNavigationRequestBudget, detectEmbedStatus, encodeRemixEvidence, isMainDocumentWithinLimit, isPrivateNetworkAddress, isStrongSharedSecret, isValidAppBaseUrl, normalizePageMetadata, resolveAnalysisOutputs, withAsyncResource } from "./analysis-contract";
import { createRemixCompilerClient, qualityFromCompilerReport, requiredRemixViewports } from "../../../src/lib/remix-compiler";

interface AnalysisMessage {
  jobId: string;
  siteId: string;
  url: string;
}

interface Env {
  BROWSER: Fetcher;
  ANALYSIS_QUEUE: Queue<AnalysisMessage>;
  ANALYSIS_ENQUEUE_SECRET: string;
  ANALYSIS_CALLBACK_SECRET: string;
  APP_BYPASS_TOKEN?: string;
  APP_BASE_URL: string;
  REMIX_COMPILER_URL: string;
  REMIX_COMPILER_API_KEY: string;
  REMIX_COMPILER_REVISION: string;
}

interface UploadTicket {
  path: string;
  signedUrl: string;
}

type TicketMap = Record<
  | "desktop"
  | "desktopFull"
  | "mobile"
  | "mobileFull"
  | "remixBundle"
  | "remixEvidence"
  | "source375"
  | "source768"
  | "source1280"
  | "source1920"
  | "clone375"
  | "clone768"
  | "clone1280"
  | "clone1920",
  UploadTicket
>;

const forbiddenHostnames = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);
const MAX_PAGE_REQUESTS = 500;

function hasWorkerConfiguration(env: Env) {
  let compilerConfigured = false;
  try {
    createRemixCompilerClient({ apiKey: env.REMIX_COMPILER_API_KEY, baseUrl: env.REMIX_COMPILER_URL });
    const compilerHostname = new URL(env.REMIX_COMPILER_URL).hostname.toLowerCase();
    const placeholderCompiler = compilerHostname.endsWith(".invalid")
      || compilerHostname.endsWith(".example")
      || compilerHostname.endsWith(".test")
      || compilerHostname === "example.com";
    compilerConfigured = !placeholderCompiler
      && isStrongSharedSecret(env.REMIX_COMPILER_API_KEY)
      && /^[a-f0-9]{40,64}$/i.test(env.REMIX_COMPILER_REVISION);
  } catch {
    compilerConfigured = false;
  }
  return Boolean(env.BROWSER && env.ANALYSIS_QUEUE && compilerConfigured)
    && isStrongSharedSecret(env.ANALYSIS_ENQUEUE_SECRET)
    && isStrongSharedSecret(env.ANALYSIS_CALLBACK_SECRET)
    && (!env.APP_BYPASS_TOKEN || isStrongSharedSecret(env.APP_BYPASS_TOKEN))
    && isValidAppBaseUrl(env.APP_BASE_URL);
}

function appBaseUrl(env: Env) {
  if (!isValidAppBaseUrl(env.APP_BASE_URL)) throw new Error("INVALID_APP_BASE_URL");
  return new URL(env.APP_BASE_URL).origin;
}

async function resolvePublicHost(hostname: string) {
  if (forbiddenHostnames.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("SSRF_HOST_BLOCKED");
  if (isPrivateNetworkAddress(hostname)) throw new Error("SSRF_IP_BLOCKED");
  const answers = await Promise.all(["A", "AAAA"].map(async (type) => {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
    });
    if (!response.ok) throw new Error("DNS_LOOKUP_FAILED");
    const json = await response.json<{ Answer?: Array<{ data: string; type: number }> }>();
    return json.Answer?.filter((answer) => answer.type === 1 || answer.type === 28).map((answer) => answer.data) ?? [];
  }));
  const addresses = answers.flat();
  if (!addresses.length || addresses.some((address) => isPrivateNetworkAddress(address))) throw new Error("SSRF_DNS_BLOCKED");
}

async function validateTarget(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("UNSUPPORTED_PROTOCOL");
  if (url.username || url.password) throw new Error("URL_CREDENTIALS_BLOCKED");
  await resolvePublicHost(url.hostname.toLowerCase());
  return url.toString();
}

async function installRequestGuard(page: Page, authorizedOrigin?: { apiKey: string; origin: string }) {
  const hostChecks = new Map<string, Promise<void>>();
  const requestBudget = createNavigationRequestBudget(MAX_PAGE_REQUESTS, 3_000);
  await page.setRequestInterception(true);
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) requestBudget.startNavigation();
  });
  page.on("request", async (request: HTTPRequest) => {
    try {
      if (!requestBudget.take() || request.resourceType() === "media") return request.abort("blockedbyclient");
      const target = new URL(request.url());
      if (target.protocol !== "http:" && target.protocol !== "https:") return request.abort("blockedbyclient");
      const host = target.hostname.toLowerCase();
      let check = hostChecks.get(host);
      if (!check) {
        check = resolvePublicHost(host);
        hostChecks.set(host, check);
      }
      await check;
      const authorizedHeaders = authorizedRequestHeaders(target, request.headers(), authorizedOrigin);
      await request.continue(authorizedHeaders ? { headers: authorizedHeaders } : undefined);
    } catch {
      await request.abort("blockedbyclient");
    }
  });
}

async function extractDesignEvidence(page: Page) {
  const serialized = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("body *")).slice(0, 2_000);
    const fontMap = new Map<string, number>();
    const colors = new Map<string, number>();
    const spacing = new Map<string, number>();
    const radii = new Map<string, number>();
    const layoutMap = new Map<string, number>();
    const componentPatterns = new Map<string, number>();
    const shadows = new Set<string>();
    const bump = (map: Map<string, number>, value: string) => value && value !== "0px" && map.set(value, (map.get(value) ?? 0) + 1);
    for (const element of elements) {
      const style = getComputedStyle(element);
      bump(fontMap, `${style.fontFamily}|${style.fontSize}|${style.fontWeight}|${style.lineHeight}|${style.letterSpacing}`);
      bump(colors, style.color);
      bump(colors, style.backgroundColor);
      [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft, style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft, style.gap].forEach((value) => bump(spacing, value));
      bump(radii, style.borderRadius);
      if (style.display === "flex" || style.display === "inline-flex" || style.display === "grid" || style.display === "inline-grid") {
        bump(layoutMap, [style.display, style.flexDirection, style.alignItems, style.justifyContent, style.gridTemplateColumns, style.gap].join("|"));
      }
      const role = element.getAttribute("role") ?? "";
      const classTokens = Array.from(element.classList).filter((value) => value.length <= 80).sort().slice(0, 8);
      const signature = [element.tagName.toLowerCase(), role, classTokens.join(".")].join("|");
      if (role || classTokens.length) componentPatterns.set(signature, (componentPatterns.get(signature) ?? 0) + 1);
      if (style.boxShadow !== "none") shadows.add(style.boxShadow);
    }
    const rank = (map: Map<string, number>, limit: number) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));
    const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"],meta[property="${name}"]`)?.content ?? "";
    const markerSignals = [
      ["data-slot", "[data-slot]"],
      ["radix", "[data-radix-collection-item], [data-radix-menu-content], [data-radix-dialog-content]"],
      ["mui-class", "[class*='Mui']"],
      ["ant-class", "[class*='ant-']"],
      ["chakra-class", "[class*='chakra']"],
      ["mantine-class", "[class*='mantine']"],
    ].map(([marker, selector]) => ({ marker, count: document.querySelectorAll(selector).length })).filter(({ count }) => count > 0);
    const rootStyle = getComputedStyle(document.documentElement);
    const rootCssVariables: Record<string, string> = {};
    for (let index = 0; index < rootStyle.length && Object.keys(rootCssVariables).length < 128; index += 1) {
      const name = rootStyle.item(index);
      if (name.startsWith("--")) rootCssVariables[name] = rootStyle.getPropertyValue(name).trim().slice(0, 200);
    }
    const loadedFontFaces = Array.from(document.fonts).slice(0, 64).map((font) => ({
      family: font.family.slice(0, 200),
      style: font.style.slice(0, 80),
      weight: font.weight.slice(0, 80),
      status: font.status,
    }));
    const layoutContainers = elements.flatMap((element) => {
      const style = getComputedStyle(element);
      if (!["flex", "inline-flex", "grid", "inline-grid"].includes(style.display)) return [];
      const box = element.getBoundingClientRect();
      return [{
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") ?? undefined,
        classes: Array.from(element.classList).slice(0, 8).map((value) => value.slice(0, 80)),
        childCount: element.children.length,
        box: { x: Math.round(box.x), y: Math.round(box.y + window.scrollY), width: Math.round(box.width), height: Math.round(box.height) },
        display: style.display,
        flexDirection: style.flexDirection,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        gridTemplateColumns: style.gridTemplateColumns,
        gap: style.gap,
      }];
    }).slice(0, 80);
    return JSON.stringify({
      title: document.title,
      description: meta("description") || meta("og:description"),
      language: document.documentElement.lang,
      sampling: {
        sampledNodeCount: elements.length,
        totalNodeCount: document.querySelectorAll("body *").length,
        truncated: document.querySelectorAll("body *").length > elements.length,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight, documentHeight: document.documentElement.scrollHeight },
      fonts: rank(fontMap, 16),
      colors: rank(colors, 24),
      spacing: rank(spacing, 16),
      radii: rank(radii, 12),
      shadows: [...shadows].slice(0, 12),
      layoutPrimitives: rank(layoutMap, 32),
      repeatedElementPatterns: rank(componentPatterns, 40).filter(({ count }) => count >= 2),
      uiLibraryMarkerSignals: markerSignals,
      rootCssVariables,
      loadedFontFaces,
      layoutContainers,
      landmarks: Array.from(document.querySelectorAll("header,nav,main,section,aside,footer")).slice(0, 80).map((element) => ({ tag: element.tagName.toLowerCase(), label: element.getAttribute("aria-label") || "" })),
      headings: Array.from(document.querySelectorAll("h1,h2,h3")).slice(0, 40).map((element) => ({ level: element.tagName, text: element.textContent?.trim().slice(0, 180) ?? "" })),
      controls: Array.from(document.querySelectorAll("button,a,input,select,textarea")).slice(0, 100).map((element) => ({ tag: element.tagName.toLowerCase(), role: element.getAttribute("role"), label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 100) || "" })),
      mediaQueries: Array.from(document.styleSheets).flatMap((sheet) => {
        try { return Array.from(sheet.cssRules).filter((rule) => rule instanceof CSSMediaRule).map((rule) => rule.conditionText); }
        catch { return []; }
      }).slice(0, 80),
    });
  });
  return JSON.parse(serialized) as Record<string, unknown>;
}

async function extractRenderEvidence(page: Page) {
  const serialized = await page.evaluate((maxNodes) => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("body *")).slice(0, maxNodes);
    const elementIndex = new Map(elements.map((element, index) => [element, index]));
    const styleProperties = [
      "display", "position", "inset", "top", "right", "bottom", "left", "zIndex",
      "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
      "boxSizing", "overflow", "overflowX", "overflowY",
      "flex", "flexBasis", "flexDirection", "flexGrow", "flexShrink", "flexWrap",
      "alignContent", "alignItems", "alignSelf", "justifyContent", "justifyItems", "justifySelf",
      "gridTemplateColumns", "gridTemplateRows", "gridAutoFlow", "gridColumn", "gridRow", "gap", "columnGap", "rowGap",
      "marginTop", "marginRight", "marginBottom", "marginLeft",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "fontFamily", "fontSize", "fontStyle", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "textTransform",
      "color", "backgroundColor", "backgroundImage", "backgroundPosition", "backgroundSize",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
      "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
      "borderRadius", "boxShadow", "opacity", "transform", "transformOrigin", "objectFit", "objectPosition",
      "transitionDuration", "transitionProperty", "animationDuration", "animationName",
    ] as const;
    const safeUrl = (value: string | null) => {
      if (!value) return undefined;
      try {
        const url = new URL(value, document.baseURI);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 2_048) : undefined;
      } catch {
        return undefined;
      }
    };
    const directText = (element: Element) => Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    const nodes = elements.map((element, index) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const styles = Object.fromEntries(styleProperties.map((property) => [property, String(style[property])]).filter(([, value]) => value !== ""));
      const mediaSource = element instanceof HTMLImageElement || element instanceof HTMLVideoElement
        ? safeUrl(element.currentSrc || element.src)
        : element instanceof HTMLSourceElement
          ? safeUrl(element.src)
          : undefined;
      return {
        index,
        parent: element.parentElement ? (elementIndex.get(element.parentElement as HTMLElement) ?? -1) : -1,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") ?? undefined,
        text: directText(element) || undefined,
        id: element.id.slice(0, 160) || undefined,
        classes: Array.from(element.classList).slice(0, 24).map((value) => value.slice(0, 160)),
        box: {
          x: Math.round(box.x * 100) / 100,
          y: Math.round((box.y + window.scrollY) * 100) / 100,
          width: Math.round(box.width * 100) / 100,
          height: Math.round(box.height * 100) / 100,
        },
        visible: box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0",
        href: element instanceof HTMLAnchorElement ? safeUrl(element.href) : undefined,
        src: mediaSource,
        styles,
      };
    });
    const rootStyle = getComputedStyle(document.documentElement);
    const cssVariables: Record<string, string> = {};
    for (let index = 0; index < rootStyle.length; index += 1) {
      const name = rootStyle.item(index);
      if (name.startsWith("--") && Object.keys(cssVariables).length < 512) cssVariables[name] = rootStyle.getPropertyValue(name).trim().slice(0, 1_000);
    }
    const mediaQueries = Array.from(document.styleSheets).flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).filter((rule) => rule instanceof CSSMediaRule).map((rule) => rule.conditionText);
      } catch {
        return [];
      }
    }).slice(0, 500);
    return JSON.stringify({
      viewport: { width: window.innerWidth, height: window.innerHeight, documentHeight: document.documentElement.scrollHeight },
      nodeCount: document.querySelectorAll("body *").length,
      truncated: document.querySelectorAll("body *").length > maxNodes,
      nodes,
      cssVariables,
      mediaQueries,
    });
  }, 6_000);
  return JSON.parse(serialized) as Record<string, unknown>;
}

async function navigationTransferSize(page: Page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return navigation?.transferSize ?? 0;
  });
}

async function captureBoundedFullPage(page: Page, width: number) {
  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  return await page.screenshot({
    captureBeyondViewport: true,
    clip: { height: clampFullPageHeight(documentHeight), width, x: 0, y: 0 },
    quality: 78,
    type: "webp",
  }) as Uint8Array;
}

async function requestTickets(message: AnalysisMessage, env: Env): Promise<TicketMap> {
  const response = await fetch(`${appBaseUrl(env)}/api/internal/analysis-upload-tickets`, {
    body: JSON.stringify({ jobId: message.jobId, siteId: message.siteId }),
    headers: appRequestHeaders(
      { authorization: `Bearer ${env.ANALYSIS_ENQUEUE_SECRET}`, "content-type": "application/json" },
      env.APP_BYPASS_TOKEN,
    ),
    method: "POST",
  });
  if (!response.ok) throw new Error("UPLOAD_TICKET_FAILED");
  return (await response.json<{ tickets: TicketMap }>()).tickets;
}

async function upload(ticket: UploadTicket, bytes: Uint8Array, contentType = "image/webp") {
  const response = await fetch(ticket.signedUrl, { body: bytes.buffer as ArrayBuffer, headers: { "content-type": contentType, "x-upsert": "true" }, method: "PUT" });
  if (!response.ok) throw new Error("SCREENSHOT_UPLOAD_FAILED");
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function callback(env: Env, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await hmacHex(`${timestamp}.${body}`, env.ANALYSIS_CALLBACK_SECRET);
  const response = await fetch(`${appBaseUrl(env)}/api/internal/analysis-callback`, {
    body,
    headers: appRequestHeaders(
      { "content-type": "application/json", "x-designfeed-signature": signature, "x-designfeed-timestamp": String(timestamp) },
      env.APP_BYPASS_TOKEN,
    ),
    method: "POST",
  });
  if (!response.ok) throw new Error(`CALLBACK_FAILED_${response.status}`);
}

async function generateSpec(env: Env, message: AnalysisMessage, extraction: Record<string, unknown>) {
  const response = await fetch(`${appBaseUrl(env)}/api/internal/generate-spec`, {
    body: JSON.stringify({ jobId: message.jobId, url: message.url, extraction }),
    headers: appRequestHeaders(
      { authorization: `Bearer ${env.ANALYSIS_ENQUEUE_SECRET}`, "content-type": "application/json" },
      env.APP_BYPASS_TOKEN,
    ),
    method: "POST",
  });
  if (!response.ok) throw new Error("DESIGN_SPEC_FAILED");
  return (await response.json<{ designSpec: Record<string, unknown> }>()).designSpec;
}

interface RemixEvidenceCapture {
  capturedAt: string;
  designEvidenceByViewport: Record<string, Record<string, unknown>>;
  screenshots: Array<{ height: number; path: string; sha256: string; width: number }>;
  viewports: Array<Record<string, unknown>>;
}

async function settleResponsiveLayout(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function captureRemixEvidence(page: Page, finalUrl: string, tickets: TicketMap): Promise<RemixEvidenceCapture> {
  const designEvidenceByViewport: Record<string, Record<string, unknown>> = {};
  const viewports: Record<string, unknown>[] = [];
  const screenshots: RemixEvidenceCapture["screenshots"] = [];
  for (const width of requiredRemixViewports) {
    const height = width === 375 ? 844 : 900;
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const response = await page.goto(finalUrl, { waitUntil: "networkidle2", timeout: 30_000 });
    if (!response) throw new Error("REMIX_VIEWPORT_DOCUMENT_FAILED");
    if (!isMainDocumentWithinLimit(response.headers(), await navigationTransferSize(page))) throw new Error("MAIN_DOCUMENT_TOO_LARGE");
    if (response.request().redirectChain().length > 5) throw new Error("TOO_MANY_REDIRECTS");
    await validateTarget(page.url());
    await settleResponsiveLayout(page);
    const renderEvidence = await extractRenderEvidence(page);
    assertCompleteRenderEvidence(renderEvidence);
    designEvidenceByViewport[String(width)] = await extractDesignEvidence(page);
    const documentHeight = Number((renderEvidence.viewport as { documentHeight?: number } | undefined)?.documentHeight ?? height);
    const screenshot = await captureBoundedFullPage(page, width);
    const sha256 = await sha256Hex(screenshot);
    const ticketKey = `source${width}` as "source375" | "source768" | "source1280" | "source1920";
    await upload(tickets[ticketKey], screenshot);
    screenshots.push({
      height: clampFullPageHeight(documentHeight),
      path: tickets[ticketKey].path,
      sha256,
      width,
    });
    viewports.push(renderEvidence);
  }

  return {
    capturedAt: new Date().toISOString(),
    designEvidenceByViewport,
    screenshots,
    viewports,
  };
}

async function captureCompilerScreenshots(
  page: Page,
  compilerBaseUrl: string,
  compilerJobId: string,
  tickets: TicketMap,
) {
  const compilerOrigin = new URL(compilerBaseUrl).origin;
  const screenshots: RemixEvidenceCapture["screenshots"] = [];
  for (const width of requiredRemixViewports) {
    const height = width === 375 ? 844 : 900;
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const response = await page.goto(
      `${compilerOrigin}/v1/clones/${encodeURIComponent(compilerJobId)}/app-preview/`,
      { waitUntil: "networkidle2", timeout: 30_000 },
    );
    if (!response || response.status() < 200 || response.status() >= 400) {
      throw new Error("REMIX_PREVIEW_CAPTURE_FAILED");
    }
    if (new URL(page.url()).origin !== compilerOrigin) throw new Error("REMIX_PREVIEW_ORIGIN_CHANGED");
    await settleResponsiveLayout(page);
    const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const screenshot = await captureBoundedFullPage(page, width);
    const sha256 = await sha256Hex(screenshot);
    const ticketKey = `clone${width}` as "clone375" | "clone768" | "clone1280" | "clone1920";
    await upload(tickets[ticketKey], screenshot);
    screenshots.push({
      height: clampFullPageHeight(documentHeight),
      path: tickets[ticketKey].path,
      sha256,
      width,
    });
  }
  return screenshots;
}

function compilerResult(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("REMIX_COMPILER_RESULT_INVALID");
  const result = value as Record<string, unknown>;
  if (typeof result.jobId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(result.jobId)) throw new Error("REMIX_COMPILER_JOB_INVALID");
  if (typeof result.compilerVersion !== "string" || !result.compilerVersion || result.compilerVersion.length > 40) throw new Error("REMIX_COMPILER_VERSION_INVALID");
  return { jobId: result.jobId, compilerVersion: result.compilerVersion, verify: result.verify };
}

async function compileRemixArtifact(
  env: Env,
  message: AnalysisMessage,
  finalUrl: string,
  title: string,
  tickets: TicketMap,
  evidence: RemixEvidenceCapture,
) {
  const compiler = createRemixCompilerClient({
    apiKey: env.REMIX_COMPILER_API_KEY,
    baseUrl: env.REMIX_COMPILER_URL,
  });
  const initialJob = await compiler.start(finalUrl);
  const result = compilerResult(await compiler.waitForResult(initialJob));
  const quality = qualityFromCompilerReport(result.verify);
  if (quality.status !== "passed") throw new Error("REMIX_QUALITY_BELOW_90");
  const cloneScreenshots = await withAsyncResource(
    () => puppeteer.launch(env.BROWSER),
    async (previewBrowser) => {
      const previewPage = await previewBrowser.newPage();
      const compilerOrigin = new URL(env.REMIX_COMPILER_URL).origin;
      await installRequestGuard(previewPage, {
        apiKey: env.REMIX_COMPILER_API_KEY,
        origin: compilerOrigin,
      });
      return captureCompilerScreenshots(
        previewPage,
        env.REMIX_COMPILER_URL,
        result.jobId,
        tickets,
      );
    },
  );

  const evidenceBytes = encodeRemixEvidence({
    capturedAt: evidence.capturedAt,
    compilerJobId: result.jobId,
    compilerVersion: result.compilerVersion,
    compilerVerify: result.verify,
    viewports: evidence.viewports,
  });
  const evidenceSha256 = await sha256Hex(evidenceBytes);
  await upload(tickets.remixEvidence, evidenceBytes, "application/json");

  const bundle = await compiler.downloadBundle(result.jobId);
  const computedBundleSha256 = await sha256Hex(bundle.bytes);
  if (bundle.sha256 && computedBundleSha256 !== bundle.sha256) throw new Error("REMIX_BUNDLE_HASH_MISMATCH");
  await upload(tickets.remixBundle, bundle.bytes, "application/gzip");

  const capturedAt = new Date().toISOString();
  const artifactBaseUrl = `${appBaseUrl(env)}/api/remix/${encodeURIComponent(message.siteId)}`;
  return {
    artifact: {
      version: "2.0",
      artifactId: `remix_${message.siteId.replace(/[^a-zA-Z0-9_-]/g, "_")}_${message.jobId.replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, 160),
      generatedAt: capturedAt,
      compiler: {
        name: "designfeed-render-compiler",
        version: result.compilerVersion,
        sourceRevision: env.REMIX_COMPILER_REVISION,
        deterministic: true,
      },
      reference: {
        siteId: message.siteId,
        title,
        originalUrl: finalUrl,
        capturedAt,
      },
      evidence: {
        renderIr: {
          url: `${artifactBaseUrl}/evidence`,
          sha256: evidenceSha256,
          bytes: evidenceBytes.byteLength,
        },
        sourceScreenshots: evidence.screenshots.map(({ width, height, sha256 }) => ({
          width,
          height,
          sha256,
          url: `${artifactBaseUrl}/source/${width}`,
        })),
        cloneScreenshots: cloneScreenshots.map(({ width, height, sha256 }) => ({
          width,
          height,
          sha256,
          url: `${artifactBaseUrl}/clone/${width}`,
        })),
      },
      delivery: {
        format: "tgz",
        framework: "next",
        bundleUrl: `${artifactBaseUrl}/bundle`,
        bundleSha256: computedBundleSha256,
        bundleBytes: bundle.bytes.byteLength,
        manifestUrl: `${artifactBaseUrl}/manifest`,
        previewUrl: `${artifactBaseUrl}/preview/`,
      },
      quality,
      safety: {
        publicSurfaceOnly: true,
        executableSourceScriptsIncluded: false,
        credentialFlowsBlocked: true,
        assetPolicy: "reference-only",
        untrustedContentBoundary: "BEGIN_UNTRUSTED_REFERENCE_DATA",
      },
    },
    bundlePath: tickets.remixBundle.path,
    compilerJobId: result.jobId,
    evidencePath: tickets.remixEvidence.path,
  };
}

async function processMessage(message: AnalysisMessage, env: Env, attempt: number) {
  const startedAt = Date.now();
  const target = await validateTarget(message.url);
  await callback(env, { attempts: attempt, jobId: message.jobId, status: "capturing" });
  const tickets = await requestTickets(message, env);
  const capture = await withAsyncResource(
    () => puppeteer.launch(env.BROWSER),
    async (browser) => {
      const page = await browser.newPage();
      await installRequestGuard(page);
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      const mainResponse = await page.goto(target, { waitUntil: "networkidle2", timeout: 30_000 });
      if (!mainResponse) throw new Error("MAIN_DOCUMENT_FAILED");
      if (!isMainDocumentWithinLimit(mainResponse.headers(), await navigationTransferSize(page))) throw new Error("MAIN_DOCUMENT_TOO_LARGE");
      if (mainResponse.request().redirectChain().length > 5) throw new Error("TOO_MANY_REDIRECTS");
      const finalUrl = await validateTarget(page.url());
      if (new URL(finalUrl).hostname !== new URL(target).hostname) await validateTarget(finalUrl);
      const embedStatus = detectEmbedStatus(mainResponse.headers(), appBaseUrl(env));
      const desktop = await page.screenshot({ type: "webp", quality: 82, fullPage: false }) as Uint8Array;
      const desktopFull = await captureBoundedFullPage(page, 1440);
      const desktopEvidence = await extractDesignEvidence(page);
      const metadata = normalizePageMetadata({ title: desktopEvidence.title, description: desktopEvidence.description });
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      const mobileResponse = await page.reload({ waitUntil: "networkidle2", timeout: 30_000 });
      if (!mobileResponse) throw new Error("MOBILE_DOCUMENT_FAILED");
      if (!isMainDocumentWithinLimit(mobileResponse.headers(), await navigationTransferSize(page))) throw new Error("MAIN_DOCUMENT_TOO_LARGE");
      const mobile = await page.screenshot({ type: "webp", quality: 82, fullPage: false }) as Uint8Array;
      const mobileFull = await captureBoundedFullPage(page, 390);

      await Promise.all([
        upload(tickets.desktop, desktop), upload(tickets.desktopFull, desktopFull),
        upload(tickets.mobile, mobile), upload(tickets.mobileFull, mobileFull),
      ]);
      const remixEvidence = await captureRemixEvidence(page, finalUrl, tickets);
      return { embedStatus, finalUrl, metadata, remixEvidence };
    },
  );

  await callback(env, { attempts: attempt, jobId: message.jobId, status: "analyzing" });
  const extraction = {
    finalUrl: capture.finalUrl,
    responsiveViewports: capture.remixEvidence.designEvidenceByViewport,
  };
  const [designSpecResult, remixResult] = await Promise.allSettled([
    generateSpec(env, message, extraction),
    compileRemixArtifact(
      env,
      message,
      capture.finalUrl,
      capture.metadata.title,
      tickets,
      capture.remixEvidence,
    ),
  ]);
  const { designSpec, remix } = resolveAnalysisOutputs(designSpecResult, remixResult);
  await callback(env, {
    jobId: message.jobId,
    status: "in_review",
    attempts: attempt,
    durationMs: Date.now() - startedAt,
    title: capture.metadata.title,
    summary: capture.metadata.summary,
    finalUrl: capture.finalUrl,
    embedStatus: capture.embedStatus,
    screenshotDesktop: tickets.desktop.path,
    screenshotDesktopFull: tickets.desktopFull.path,
    screenshotMobile: tickets.mobile.path,
    screenshotMobileFull: tickets.mobileFull.path,
    extraction,
    designSpec,
    remixArtifact: remix.artifact,
    remixBundlePath: remix.bundlePath,
    remixEvidencePath: remix.evidencePath,
    remixCompilerJobId: remix.compilerJobId,
  });
}

function isAnalysisMessage(value: unknown): value is AnalysisMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return typeof message.jobId === "string" && typeof message.siteId === "string" && typeof message.url === "string";
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      const healthy = hasWorkerConfiguration(env);
      return Response.json({ status: healthy ? "healthy" : "degraded", service: "designfeed-analyzer", version: "1.0" }, { headers: { "cache-control": "no-store" }, status: healthy ? 200 : 503 });
    }
    if (request.method !== "POST" || url.pathname !== "/enqueue") return new Response("Not found", { status: 404 });
    if (!hasWorkerConfiguration(env)) return new Response("Service unavailable", { status: 503 });
    if (request.headers.get("authorization") !== `Bearer ${env.ANALYSIS_ENQUEUE_SECRET}`) return new Response("Unauthorized", { status: 401 });
    const message = await request.json().catch(() => null);
    if (!isAnalysisMessage(message)) return Response.json({ error: "Invalid message" }, { status: 400 });
    await validateTarget(message.url);
    await env.ANALYSIS_QUEUE.send(message, { contentType: "json" });
    return Response.json({ queued: true }, { status: 202 });
  },

  async queue(batch, env): Promise<void> {
    if (!hasWorkerConfiguration(env)) {
      for (const message of batch.messages) message.retry({ delaySeconds: 600 });
      return;
    }
    for (const message of batch.messages) {
      try {
        await processMessage(message.body, env, Math.min(message.attempts, 3));
        message.ack();
      } catch (error) {
        const errorCode = error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ANALYSIS_ERROR";
        await callback(env, { attempts: Math.min(message.attempts, 3), jobId: message.body.jobId, status: "failed", errorCode }).catch(() => undefined);
        if (message.attempts >= 3) message.ack();
        else message.retry({ delaySeconds: Math.min(30 * 2 ** (message.attempts - 1), 600) });
      }
    }
  },
} satisfies ExportedHandler<Env, AnalysisMessage>;
