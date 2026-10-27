// Trusted smoke executes INSIDE candidate container; never imports candidate JS.
import assert from "node:assert/strict";

const request = async (method, body) => {
  const response = await fetch("http://127.0.0.1:3000/items", {
    method,
    body,
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(1500),
  });
  assert.equal(response.status, 200);
  return response.json();
};
assert.deepEqual(await request("GET"), { items: [] });
const write = await request("POST", '{"value":"unit-public"}');
assert.equal(write.items.length, 1);
assert.equal(write.items[0].value, "unit-public");
assert.deepEqual(await request("GET"), write);
console.log(
  JSON.stringify({
    phase: "unit-smoke",
    checks: ["empty", "write", "read"],
    status: "PASS_SCOPED",
  }),
);
