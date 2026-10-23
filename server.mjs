import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 5173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (pathname === "/runtime-config.js") {
      const apiUrl = process.env.GEOTWIN_API_URL || "";
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      res.end(`window.GEOTWIN_CONFIG = ${JSON.stringify({ apiUrl })};`);
      return;
    }
    let relative = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
    let target = join(root, relative === "/" ? "index.html" : relative);
    try {
      if (!(await stat(target)).isFile()) throw new Error("not a file");
    } catch {
      target = join(root, "index.html");
    }
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": mime[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Server error: ${error.message}`);
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`GeoTwin 360 running at http://localhost:${port}`);
});
