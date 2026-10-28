// Opt-in local provisioning transport. Never substitutes HTTP/SQLite observations.
import assert from "node:assert/strict";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { json, sha } from "./lib.mjs";

export function offlineFetch(bundle, directory, record = () => {}) {
  const url = `https://codeload.github.com/${bundle.source.repository}/tar.gz/${bundle.source.commit}`;
  return async (input, options = {}) => {
    options.signal?.throwIfAborted();
    if (input !== url || (options.method && options.method !== "GET")) {
      record("REMOTE_FALLBACK_DENIED");
      throw Error("OFFLINE_REMOTE_FORBIDDEN");
    }
    const bytes = readFileSync(join(directory, "source.tgz"));
    assert.equal(sha(bytes), bundle.source.archiveSha256, "PREFETCH_DIGEST");
    record("LOCAL_SOURCE_ARCHIVE");
    return new Response(bytes, { status: 200 });
  };
}
if (process.env.MMP054_PRELOAD === "1") {
  const directory = process.env.MMP054_BUNDLE;
  const bundle = json(join(directory, "prepared.json"));
  assert.equal(
    sha(readFileSync(join(directory, "prepared.json"))),
    process.env.MMP054_BUNDLE_SHA,
  );
  globalThis.fetch = offlineFetch(bundle, directory, (event) => {
    appendFileSync(
      process.env.MMP054_TRANSPORT_LOG,
      `${JSON.stringify({ event })}\n`,
      { mode: 0o600 },
    );
  });
}
