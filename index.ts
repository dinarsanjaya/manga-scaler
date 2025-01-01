import { serve } from "bun";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const komikPath = "./komik";
const indexPath = join(import.meta.dir, "index.html");

// Helper untuk membaca direktori
function readKomik(path: string): Record<string, any> {
  const result: Record<string, any> = {};
  const items = readdirSync(path);

  for (const item of items) {
    const fullPath = join(path, item);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      result[item] = readKomik(fullPath); // Rekursif untuk subfolder
    } else if (stats.isFile() && item.match(/\.(png|jpg|jpeg|gif)$/)) {
      result[item] = `/api/image?path=${encodeURIComponent(fullPath)}`;
    }
  }
  return result;
}

// Helper untuk menambahkan header CORS
function withCORS(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, {
    ...response,
    headers,
  });
}

// Endpoint handler
function handleRequest(req: Request): Response {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return withCORS(new Response(null, { status: 204 }));
  }

  if (path === "/") {
    const html = readFileSync("./public/index.html", "utf-8");
    return withCORS(
      new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );
  }

  // Serve static files
  if (path.startsWith("/public/")) {
    const filePath = `.${path}`;
    try {
      const fileContent = readFileSync(filePath);
      const contentType = path.endsWith(".css")
        ? "text/css"
        : path.endsWith(".js")
        ? "application/javascript"
        : "text/plain";
      return withCORS(
        new Response(fileContent, {
          status: 200,
          headers: { "Content-Type": contentType },
        })
      );
    } catch {
      return withCORS(new Response("File not found", { status: 404 }));
    }
  }

  if (path === "/api/komik") {
    const judulList = readdirSync(komikPath).filter((dir) => {
      return statSync(join(komikPath, dir)).isDirectory();
    });
    return withCORS(
      new Response(JSON.stringify(judulList), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  if (path.startsWith("/api/komik")) {
    const parts = path.split("/").filter((p) => p); // Split path
    const judul = parts[2];
    const chapter = parts[3];

    if (!judul) {
      return withCORS(new Response("Judul not specified", { status: 400 }));
    }

    const judulPath = join(komikPath, judul);

    if (!chapter) {
      try {
        const chapters = readdirSync(judulPath)
          .filter((dir) => statSync(join(judulPath, dir)).isDirectory())
          .sort((a, b) => {
            // Mengurutkan berdasarkan chapter dengan mempertimbangkan angka
            return a.localeCompare(b, undefined, { numeric: true });
          });
        return withCORS(
          new Response(JSON.stringify(chapters), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      } catch {
        return withCORS(new Response("Judul not found", { status: 404 }));
      }
    }

    const chapterPath = join(judulPath, chapter);
    try {
      const images = readdirSync(chapterPath)
        .filter((file) => file.match(/\.(png|jpg|jpeg|gif)$/))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const imagePaths = images.map(
        (file) =>
          `/api/image?path=${encodeURIComponent(join(chapterPath, file))}`
      );
      return withCORS(
        new Response(JSON.stringify(imagePaths), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    } catch {
      return withCORS(new Response("Chapter not found", { status: 404 }));
    }
  }

  if (path.startsWith("/api/image")) {
    const filePath = url.searchParams.get("path");

    if (!filePath) {
      return withCORS(new Response("File path not specified", { status: 400 }));
    }

    try {
      const file = Bun.file(filePath);
      return withCORS(new Response(file, { status: 200 }));
    } catch {
      return withCORS(new Response("File not found", { status: 404 }));
    }
  }

  return withCORS(new Response("Not Found", { status: 404 }));
}

// Start the server
serve({
  fetch: handleRequest,
  port: 3000,
  hostname: "0.0.0.0",
});

console.clear();
console.log("Server running at http://localhost:3000");
