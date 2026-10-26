import {
  type HealthResponse,
  HealthResponseSchema,
} from "@metamorph/contracts";
import Fastify from "fastify";

export function buildServer() {
  const server = Fastify({ logger: false });
  server.get<{ Reply: HealthResponse }>("/api/health", async () =>
    HealthResponseSchema.parse({
      status: "ok",
      service: "metamorph-server",
      scope: "foundation",
      capabilities: {
        migration: "not_implemented",
        oracle: "not_implemented",
        metaApi: "not_integrated",
        benchmark: "undecided",
      },
    }),
  );
  return server;
}
