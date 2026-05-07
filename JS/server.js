const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG = {
  httpsPort: Number(process.env.HTTPS_PORT || 8443),
  certPath: process.env.HTTPS_CERT || path.join(__dirname, "cert.pem"),
  keyPath: process.env.HTTPS_KEY || path.join(__dirname, "key.pem"),
  proxies: {
    "/proxy/wifi/": "http://192.168.1.136:8080/",
    "/proxy/lan/": "http://192.168.2.136:8080/",
  },
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getContentType(filePath) {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
    "application/octet-stream"
  );
}

function isPathInside(parent, child) {
  const rel = path.relative(parent, child);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolveFilePath(urlPath) {
  let pathname = decodeURIComponent(urlPath || "/");
  if (pathname.includes("\0")) return null;
  if (pathname.startsWith("/")) pathname = pathname.slice(1);
  if (pathname === "") {
    pathname = "index.html";
  } else if (pathname.endsWith("/")) {
    pathname = `${pathname}index.html`;
  }
  const filePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!isPathInside(ROOT_DIR, filePath)) return null;
  return filePath;
}

function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const filePath = resolveFilePath(url.pathname);
  if (!filePath) {
    res.statusCode = 400;
    res.end("Bad Request");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    res.setHeader("Content-Type", getContentType(filePath));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      res.statusCode = 500;
      res.end("Server Error");
    });
    stream.pipe(res);
  });
}

function handleProxy(req, res) {
  const reqUrl = new URL(req.url, `https://${req.headers.host}`);

  for (const [prefix, target] of Object.entries(CONFIG.proxies)) {
    let pathname = reqUrl.pathname;
    if (pathname === prefix.slice(0, -1)) pathname = prefix;
    if (!pathname.startsWith(prefix)) continue;

    const targetBase = new URL(target);
    const suffix = pathname.slice(prefix.length).replace(/^\/+/, "");
    const basePath = targetBase.pathname.endsWith("/")
      ? targetBase.pathname
      : `${targetBase.pathname}/`;
    const targetPath = `${basePath}${suffix}${reqUrl.search}`;

    const client = targetBase.protocol === "https:" ? https : http;
    const proxyReq = client.request(
      {
        protocol: targetBase.protocol,
        hostname: targetBase.hostname,
        port: targetBase.port || (targetBase.protocol === "https:" ? 443 : 80),
        method: req.method,
        path: targetPath,
        headers: {
          ...req.headers,
          host: targetBase.host,
          "x-forwarded-proto": "https",
          "x-forwarded-host": req.headers.host,
          "x-forwarded-for": req.socket.remoteAddress || "",
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", () => {
      res.statusCode = 502;
      res.end("Bad Gateway");
    });

    req.pipe(proxyReq);
    return true;
  }

  return false;
}

let httpsOptions;
try {
  httpsOptions = {
    key: fs.readFileSync(CONFIG.keyPath),
    cert: fs.readFileSync(CONFIG.certPath),
  };
} catch (err) {
  console.error("Missing HTTPS key/cert:", err.message);
  process.exit(1);
}

const server = https.createServer(httpsOptions, (req, res) => {
  if (handleProxy(req, res)) return;
  serveStatic(req, res);
});

server.listen(CONFIG.httpsPort, () => {
  console.log(`HTTPS server listening on ${CONFIG.httpsPort}`);
});
