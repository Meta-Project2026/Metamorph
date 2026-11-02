/*
MIT License

Copyright (c) 2026 Tanjila Afsari Rubina

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Entrypoint: initialize the SQLite schema and seed data in
// /state/target.sqlite, then serve the original /api.php action routes on
// 127.0.0.1:3000. This module plays the role of the PHP SAPI: it builds the
// $_GET / $_POST equivalents (query string always; urlencoded or multipart
// body for POST only), sets the JSON content type api.php sets up front and
// answers with HTTP 200 like PHP does for every handled action.
import * as http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { getDBConnection } from "./config.js";
import { handleAction, rollbackBooking } from "./api.js";
import type { PhpRequest } from "./api.js";
import { phpKeyName } from "./phpcompat.js";

// PHP post_max_size default; larger bodies leave the POST map empty.
const POST_MAX_BYTES = 8 * 1024 * 1024;

// parse_str(): "+" decodes to a space, later duplicate names overwrite
// earlier ones for scalar values.
function parseParamsInto(
  target: Record<string, string>,
  input: string,
): void {
  if (input === "") {
    return;
  }
  const search = new URLSearchParams(input);
  const seen = new Set<string>();
  search.forEach((value: string, key: string) => {
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const values = search.getAll(key);
    target[phpKeyName(key)] = values[values.length - 1] ?? "";
  });
}

function parseMultipartFields(
  target: Record<string, string>,
  bodyText: string,
  contentType: string,
): void {
  const boundaryMatch = /boundary=(?:"([^"]*)"|([^;,\s]+))/i.exec(contentType);
  if (boundaryMatch === null) {
    return;
  }
  const boundary =
    "--" +
    (boundaryMatch[1] !== undefined
      ? boundaryMatch[1]
      : (boundaryMatch[2] ?? ""));
  const segments = bodyText.split(boundary);
  for (let i = 1; i < segments.length; i += 1) {
    let segment = segments[i];
    if (segment.startsWith("--")) {
      continue; // closing delimiter or epilogue
    }
    if (segment.startsWith("\r\n")) {
      segment = segment.slice(2);
    } else if (segment.startsWith("\n")) {
      segment = segment.slice(1);
    }
    const crlf = segment.indexOf("\r\n\r\n");
    const lf = segment.indexOf("\n\n");
    let headerBlock: string;
    let value: string;
    if (crlf !== -1 && (lf === -1 || crlf <= lf)) {
      headerBlock = segment.slice(0, crlf);
      value = segment.slice(crlf + 4);
    } else if (lf !== -1) {
      headerBlock = segment.slice(0, lf);
      value = segment.slice(lf + 2);
    } else {
      continue;
    }
    if (value.endsWith("\r\n")) {
      value = value.slice(0, -2);
    } else if (value.endsWith("\n")) {
      value = value.slice(0, -1);
    }
    // File parts land in PHP's $_FILES, never in $_POST.
    if (/filename="/i.test(headerBlock)) {
      continue;
    }
    const quoted = /name="((?:[^"\\]|\\.)*)"/i.exec(headerBlock);
    const unquoted = /name=([^;\s"]+)/i.exec(headerBlock);
    const name =
      quoted !== null
        ? quoted[1]?.replace(/\\(.)/g, "$1")
        : unquoted !== null
          ? unquoted[1]
          : null;
    if (name === null || name === undefined) {
      continue;
    }
    target[phpKeyName(name)] = value;
  }
}

function respond(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

function handleApiRequest(
  db: DatabaseSync,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const url = req.url ?? "/";
  const queryIndex = url.indexOf("?");
  const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
  if (path !== "/api.php") {
    // Outside the five-action API slice the original tree serves other files;
    // the migration scope only mounts /api.php.
    res.statusCode = 404;
    res.end();
    return;
  }

  const get: Record<string, string> = {};
  parseParamsInto(get, queryIndex === -1 ? "" : url.slice(queryIndex + 1));

  const method = req.method ?? "";
  const contentTypeHeader = req.headers["content-type"];
  const contentType =
    typeof contentTypeHeader === "string" ? contentTypeHeader.toLowerCase() : "";
  const mediaType = contentType.split(";")[0]?.trim() ?? "";
  const isPost = method === "POST";

  const chunks: Buffer[] = [];
  let bodyBytes = 0;
  let bodyTooLarge = false;
  req.on("data", (chunk: Buffer) => {
    bodyBytes += chunk.length;
    if (bodyBytes > POST_MAX_BYTES) {
      bodyTooLarge = true;
      chunks.length = 0;
      return;
    }
    chunks.push(chunk);
  });
  req.on("error", () => {
    res.destroy();
  });
  req.on("end", () => {
    const post: Record<string, string> = {};
    try {
      if (
        isPost &&
        !bodyTooLarge &&
        (mediaType === "application/x-www-form-urlencoded" ||
          mediaType === "multipart/form-data")
      ) {
        const bodyText = Buffer.concat(chunks).toString("utf8");
        if (mediaType === "application/x-www-form-urlencoded") {
          parseParamsInto(post, bodyText);
        } else {
          parseMultipartFields(post, bodyText, contentType);
        }
      }
      const request: PhpRequest = { method: method, get: get, post: post };
      const body = handleAction(db, request);
      respond(res, 200, body);
    } catch {
      // PHP aborts a request that throws after echoing the header; keep the
      // JSON content type, return 500 with no body and release any booking
      // lock the PHP request connection would have rolled back.
      rollbackBooking(db);
      respond(res, 500, "");
    }
  });
}

function main(): void {
  const db = getDBConnection();
  const server = http.createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      handleApiRequest(db, req, res);
    },
  );
  server.listen(3000, "127.0.0.1");
}

main();
