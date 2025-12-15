#!/usr/bin/env node
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = { dir: null, port: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dir") args.dir = argv[i + 1] ?? null;
    if (a === "--port") args.port = argv[i + 1] ?? null;
  }
  return args;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".map":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function existsFile(filePath) {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

async function main() {
  const { dir: dirArg, port: portArg } = parseArgs(process.argv.slice(2));
  const dir = dirArg ? path.resolve(process.cwd(), dirArg) : null;
  const port = portArg ? Number.parseInt(portArg, 10) : NaN;

  if (!dir || !Number.isFinite(port)) {
    console.error("Usage: node scripts/serve-spa.mjs --dir <path> --port <port>");
    process.exitCode = 2;
    return;
  }

  const indexPath = path.join(dir, "index.html");
  if (!(await existsFile(indexPath))) {
    console.error(`Missing ${indexPath}. Did you run a production build first?`);
    process.exitCode = 2;
    return;
  }

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const decodedPath = decodeURIComponent(url.pathname);

    let filePath = path.join(dir, decodedPath);
    if (decodedPath.endsWith("/")) filePath = path.join(filePath, "index.html");

    const rel = path.relative(dir, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Forbidden");
      return;
    }

    const servedPath = (await existsFile(filePath)) ? filePath : indexPath;

    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeFor(servedPath));
    res.setHeader("Cache-Control", servedPath.endsWith(".html") ? "no-cache" : "public, max-age=3600");

    if (method === "HEAD") {
      res.end();
      return;
    }

    createReadStream(servedPath).pipe(res);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Serving ${dir} on http://localhost:${port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await main();
