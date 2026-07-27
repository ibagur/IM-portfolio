#!/usr/bin/env node

/**
 * Local web server with a 30-minute FIRMS refresh cycle and fixed perimeter.
 * Usage: node scripts/serve-live-map.mjs
 * Optional: --port=8000 --refresh-minutes=30
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const optionValue = (name, fallback) => {
  const argument = process.argv.find(value => value.startsWith(`--${name}=`));
  const value = Number(argument?.slice(name.length + 3));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const port = optionValue("port", 8000);
const refreshMinutes = optionValue("refresh-minutes", 30);
const refreshIntervalMs = refreshMinutes * 60 * 1000;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".kml": "application/vnd.google-earth.kml+xml; charset=utf-8",
};

let refreshInProgress = false;
function refreshSnapshot() {
  if (refreshInProgress) return Promise.resolve();
  refreshInProgress = true;
  return new Promise((resolveRefresh, rejectRefresh) => {
    const child = spawn(process.execPath, ["scripts/export-current-firms.mjs"], { cwd: root, stdio: "inherit" });
    child.once("error", rejectRefresh);
    child.once("exit", code => code === 0 ? resolveRefresh() : rejectRefresh(new Error(`Snapshot refresh failed with exit code ${code}.`)));
  }).finally(() => { refreshInProgress = false; });
}

function mapRequestToFile(requestUrl) {
  const requestPath = decodeURIComponent(new URL(requestUrl ?? "/", "http://localhost").pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = normalize(join(root, relativePath));
  if (!filePath.startsWith(`${root}/`) && filePath !== root) return undefined;
  return filePath;
}

const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const filePath = mapRequestToFile(request.url);
  if (!filePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) throw new Error("Not a file");
    const headers = {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    };
    response.writeHead(200, headers);
    if (request.method === "GET") response.end(await readFile(filePath));
    else response.end();
  } catch {
    response.writeHead(404).end("Not found");
  }
});

try {
  await refreshSnapshot();
} catch (error) {
  console.error(`Initial refresh failed; serving the most recent local snapshot. ${error.message}`);
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Live fire map: http://127.0.0.1:${port}`);
  console.log(`Refreshing FIRMS fire data every ${refreshMinutes} minutes; the forest perimeter is fixed.`);
});

const timer = setInterval(() => {
  refreshSnapshot().catch(error => console.error(error.message));
}, refreshIntervalMs);

function stop() {
  clearInterval(timer);
  server.close(() => process.exit(0));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
