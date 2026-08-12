import { z } from "zod";

const submissionUrlSchema = z.string().trim().min(1).max(2048);

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:") ||
    isPrivateIpv4(host)
  );
}

export function normalizeSubmissionUrl(input: string) {
  const raw = submissionUrlSchema.parse(input);
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("请输入完整有效的网址");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 HTTP 或 HTTPS 网址");
  }
  if (url.username || url.password) {
    throw new Error("网址不能包含账号信息");
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error("不能提交本机或内网网址");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString().replace(/\/$/, "");
}
