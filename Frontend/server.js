const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");

const START_PORT = Number(process.env.PORT || 5500);
const ROOT = __dirname;
const API_TARGET = "http://127.0.0.1:4000";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8"
};

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function proxyApi(req, res) {
  const target = new URL(req.url, API_TARGET);
  const proxyReq = http.request(target, {
    method: req.method,
    headers: {
      ...req.headers,
      host: "127.0.0.1:4000"
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", () => {
    send(res, 502, "Portal API unavailable");
  });

  req.pipe(proxyReq);
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const requestedPath = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = path.join(ROOT, requestedPath);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(ROOT)) {
    return null;
  }

  return normalized;
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  const filePath = resolveRequestPath(req.url || "/");

  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, "Page not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

function findFreePort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", () => {
      resolve(findFreePort(port + 1));
    });

    tester.once("listening", () => {
      tester.close(() => resolve(port));
    });

    tester.listen(port);
  });
}

findFreePort(START_PORT).then((port) => {
  server.listen(port, () => {
    console.log(`NexfordMarket frontend running at http://localhost:${port}`);
  });
});
