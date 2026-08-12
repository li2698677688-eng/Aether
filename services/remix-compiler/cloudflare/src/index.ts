import { Container } from "@cloudflare/containers";

interface Env {
  REMIX_COMPILER: {
    getByName(name: string): {
      fetch(request: Request): Promise<Response>;
      startAndWaitForPorts(options: {
        startOptions: { envVars: Record<string, string> };
      }): Promise<unknown>;
    };
  };
  REMIX_COMPILER_API_KEY: string;
}

export class RemixCompilerContainer extends Container {
  defaultPort = 8787;
  sleepAfter = "30m";
}

const handler = {
  async fetch(request: Request, workerEnv: Env): Promise<Response> {
    if (!workerEnv.REMIX_COMPILER_API_KEY || workerEnv.REMIX_COMPILER_API_KEY.length < 32) {
      return Response.json({ error: "compiler secret is not configured" }, { status: 503 });
    }
    const compiler = workerEnv.REMIX_COMPILER.getByName("primary");
    await compiler.startAndWaitForPorts({
      startOptions: {
        envVars: {
          API_KEYS: workerEnv.REMIX_COMPILER_API_KEY,
          PORT: "8787",
          RATE_LIMIT_PER_MINUTE: "60",
        },
      },
    });
    return compiler.fetch(request);
  },
};

export default handler;
