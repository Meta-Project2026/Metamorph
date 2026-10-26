import { buildServer } from "./app.js";

const portText = process.env.PORT ?? "3000";
if (!/^\d+$/.test(portText) || Number(portText) > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}

const server = buildServer();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

try {
  const address = await server.listen({
    port: Number(portText),
    host: "127.0.0.1",
  });
  console.log(JSON.stringify({ event: "listening", address }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
