// A stand-in for Teams workflow links, for local checks without a Teams account.
// Every POST to http://localhost:3999/... is written as one JSON line to storage/teams-mock.jsonl.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = Number(process.env.TEAMS_MOCK_PORT ?? 3999);
const file = path.resolve(process.env.STORAGE_DIR ?? "storage", "teams-mock.jsonl");
fs.mkdirSync(path.dirname(file), { recursive: true });

http
  .createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      if (request.method !== "POST") {
        response.writeHead(405).end();
        return;
      }
      let card: unknown = body;
      try {
        card = JSON.parse(body);
      } catch {
        // keep the raw text
      }
      fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), channel: request.url, card })}\n`);
      console.log(`[teams-mock] message for ${request.url}`);
      response.writeHead(202, { "Content-Type": "application/json" }).end('{"ok":true}');
    });
  })
  .listen(PORT, () => console.log(`[teams-mock] listening on http://localhost:${PORT}, writing to ${file}`));
