export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (value === "/login" || value.startsWith("/login?")) return "/";
  return value;
}
