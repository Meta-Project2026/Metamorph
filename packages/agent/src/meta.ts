import type { ModelProvider } from "./ports.js";

// Intentionally no guessed endpoint, model ID, auth scheme, price or transport.
// A future trusted composition root may implement ModelProvider after the probe
// in README.md. Nothing in this factory reads credentials or opens a connection.
export function createUnconfiguredMetaProvider(): ModelProvider {
  return {
    billing: "paid",
    maxRequestCostUsd: null,
    async generate() {
      throw new Error("META_INTEGRATION_NOT_CONFIGURED");
    },
  };
}
