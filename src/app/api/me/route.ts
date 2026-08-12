import { getViewer } from "@/lib/auth";

export async function GET() {
  const viewer = await getViewer();
  return Response.json({
    viewer: viewer ? { demo: viewer.demo, role: viewer.role, username: viewer.username } : null,
  }, { headers: { "cache-control": "private, no-store" } });
}
