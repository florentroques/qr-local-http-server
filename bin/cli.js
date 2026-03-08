#!/usr/bin/env node
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { createRequire } from "module";
import { execSync } from "child_process";
import readline from "readline";

const require = createRequire(import.meta.url);
const qrcode = require("qrcode-terminal");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderDirectory(dirPath, urlPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const items = entries
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry) => {
      const href = path.posix.join(urlPath, entry.name) + (entry.isDirectory() ? "/" : "");
      let size = "";
      let icon = entry.isDirectory() ? "📁" : "📄";
      if (!entry.isDirectory()) {
        try {
          const stat = fs.statSync(path.join(dirPath, entry.name));
          size = `<span class="size">${formatBytes(stat.size)}</span>`;
        } catch {}
      }
      return `<li><a href="${href}">${icon} ${entry.name}${entry.isDirectory() ? "/" : ""}</a>${size}</li>`;
    })
    .join("\n");

  const parent = urlPath !== "/" ? `<li><a href="${path.posix.dirname(urlPath.replace(/\/$/, "")) || "/"}">⬆ ..</a></li>` : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Index of ${urlPath}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { border-bottom: 1px solid #ddd; padding-bottom: .5rem; font-size: 1.2rem; }
  ul { list-style: none; padding: 0; }
  li { padding: .3rem 0; display: flex; align-items: center; gap: .5rem; }
  a { text-decoration: none; color: #0070f3; }
  a:hover { text-decoration: underline; }
  .size { margin-left: auto; color: #888; font-size: .85rem; }
</style>
</head>
<body>
<h1>Index of ${urlPath}</h1>
<ul>
${parent}
${items}
</ul>
</body>
</html>`;
}

function serveRequest(root, req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let fsPath = path.join(root, urlPath);

  let stat;
  try {
    stat = fs.statSync(fsPath);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
    return;
  }

  if (stat.isDirectory()) {
    // Try index.html first
    const index = path.join(fsPath, "index.html");
    if (fs.existsSync(index)) {
      fsPath = index;
      stat = fs.statSync(fsPath);
    } else {
      // Redirect to trailing slash if needed
      if (!urlPath.endsWith("/")) {
        res.writeHead(301, { Location: urlPath + "/" });
        res.end();
        return;
      }
      const html = renderDirectory(fsPath, urlPath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }
  }

  const ext = path.extname(fsPath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
  });

  fs.createReadStream(fsPath).pipe(res);
}

function findPidOnPort(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano`, { encoding: "utf8" });
      for (const line of output.split("\n")) {
        const match = line.match(/:(\d+)\s+.*LISTENING\s+(\d+)/);
        if (match && parseInt(match[1]) === port) return match[2];
      }
    } else {
      const output = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
      return output.trim().split("\n")[0];
    }
  } catch {}
  return null;
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" });
    } else {
      execSync(`kill -9 ${pid}`);
    }
    return true;
  } catch {
    return false;
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// --- Main ---
const args = process.argv.slice(2);
const dir = args[0] || ".";
const port = parseInt(args.find((a) => a.startsWith("--port="))?.split("=")[1] || args[args.indexOf("--port") + 1] || "8080") || 8080;

const root = path.resolve(dir);

if (!fs.existsSync(root)) {
  console.error(`Error: directory not found: ${root}`);
  process.exit(1);
}

function startServer() {
  const server = http.createServer((req, res) => {
    serveRequest(root, req, res);
  });

  server.on("error", async (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n  Port ${port} is already in use.`);
      const pid = findPidOnPort(port);
      if (pid) {
        console.error(`  Process using it: PID ${pid}`);
      }
      const answer = await ask("  Kill it and start the server? [y/N] ");
      if (answer === "y" || answer === "yes") {
        const killed = pid ? killPid(pid) : false;
        if (killed) {
          console.log(`  Killed PID ${pid}. Starting server...`);
          setTimeout(startServer, 500);
        } else {
          console.error("  Could not kill the process. Try manually.");
          process.exit(1);
        }
      } else {
        console.log("  Aborted.");
        process.exit(0);
      }
    } else {
      console.error(`  Error: ${err.message}`);
      process.exit(1);
    }
  });

  server.listen(port, "0.0.0.0", () => {
    const lanIp = getLanIp();
    const localUrl = `http://localhost:${port}`;
    const lanUrl = lanIp ? `http://${lanIp}:${port}` : null;

    console.log();
    console.log(`  Serving: ${root}`);
    console.log();
    console.log(`  Local:   ${localUrl}`);
    if (lanUrl) {
      console.log(`  Network: ${lanUrl}`);
      console.log();
      console.log("  Scan to open on your phone:");
      console.log();
      qrcode.generate(lanUrl, { small: true });
    } else {
      console.log("  Network: (not connected to LAN)");
    }
    console.log();
    console.log("  Press Ctrl+C to stop.");
    console.log();
  });
}

startServer();
