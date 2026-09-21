import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { askJev, DecideError, parseDecideInput } from "./decide";

function readKey(): string {
  const fromProcess = process.env.TYPESAFE_API_KEY?.trim();
  if (fromProcess) return fromProcess;
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  return loadEnv(mode, process.cwd(), "").TYPESAFE_API_KEY?.trim() ?? "";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 100_000) {
        reject(new DecideError("bad_request"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function statusFor(code: string): number {
  if (code === "bad_request") return 400;
  if (code === "missing_api_key") return 503;
  if (code === "rejected_key") return 401;
  if (code === "game_over") return 409;
  return 502;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const text = await readBody(req);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new DecideError("bad_request");
    }
    const input = parseDecideInput(parsed);
    const controller = new AbortController();
    req.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const decision = await askJev(input, readKey(), controller.signal);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(decision));
  } catch (error) {
    if (error instanceof DecideError && error.code === "aborted") return;
    if (res.writableEnded) return;
    const code = error instanceof DecideError ? error.code : "jev_failed";
    res.statusCode = statusFor(code);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: code }));
  }
}

function route(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if (req.method !== "POST") {
    next();
    return;
  }
  void handle(req, res);
}

export function jevPlugin(): Plugin {
  return {
    name: "jev-decide",
    configureServer(server) {
      server.middlewares.use("/api/decide", route);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/decide", route);
    },
  };
}
