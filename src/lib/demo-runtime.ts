export function isLocalDemoAllowed(nodeEnvironment = process.env.NODE_ENV) {
  return nodeEnvironment !== "production";
}
