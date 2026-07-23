import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = path.join(projectRoot, "dist", "server");
const html = await readFile(path.join(projectRoot, "index.html"), "utf8");

const worker = `const html = ${JSON.stringify(html)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const isLandingPage = url.pathname === "/" || url.pathname === "/index.html";

    if (!isLandingPage) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(request.method === "HEAD" ? null : html, {
      headers: {
        "cache-control": "public, max-age=300",
        "content-type": "text/html; charset=utf-8",
      },
    });
  },
};
`;

await rm(path.join(projectRoot, "dist"), { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "index.js"), worker);
