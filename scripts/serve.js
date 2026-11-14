// Local preview only. GitHub Pages serves the files in the repo root as they are.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 8080;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function localPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (error) {
    return null;
  }
  const rel = path.normalize(decoded).replace(/^[/\\]+/, "");
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    return null;
  }
  if (rel.split(/[/\\]/).some((part) => part.startsWith("."))) {
    return null;
  }
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) {
    return null;
  }
  return file;
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  let pathname = url.pathname;
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }
  const file = localPath(pathname);
  if (!file) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  fs.readFile(file, function (error, data) {
    if (error) {
      res.writeHead(error.code === "ENOENT" || error.code === "EISDIR" ? 404 : 500);
      res.end(error.code === "ENOENT" || error.code === "EISDIR" ? "Not found" : "Error");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", function () {
  console.log("http://127.0.0.1:" + port + "/");
});
