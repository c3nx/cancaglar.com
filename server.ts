import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { basicAuth } from "hono/basic-auth";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const app = new Hono();

const DATA_DIR = "./data";
const UPLOAD_DIR = "./uploads";
const PORTFOLIO_FILE = join(DATA_DIR, "portfolio.json");

// ─── AUTH (protects dashboard + write endpoints) ───
const auth = basicAuth({
  username: process.env.DASHBOARD_USER!,
  password: process.env.DASHBOARD_PASS!,
});

app.use("/dashboard.html", auth);
app.post("/api/*", auth);
app.delete("/api/*", auth);

// Ensure directories exist
await mkdir(DATA_DIR, { recursive: true });
await mkdir(join(UPLOAD_DIR, "images"), { recursive: true });
await mkdir(join(UPLOAD_DIR, "videos"), { recursive: true });

// ─── API ───

app.get("/api/portfolio", async (c) => {
  try {
    const data = await readFile(PORTFOLIO_FILE, "utf-8");
    return c.json(JSON.parse(data));
  } catch {
    return c.json([]);
  }
});

app.post("/api/portfolio", async (c) => {
  const items = await c.req.json();
  await writeFile(PORTFOLIO_FILE, JSON.stringify(items, null, 2));
  return c.json({ ok: true });
});

app.post("/api/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const type = formData.get("type") as string; // 'image' or 'video'

  if (!file || !type) {
    return c.json({ error: "file and type required" }, 400);
  }

  const dir = type === "video" ? "videos" : "images";
  const ext = file.name.split(".").pop() || (type === "video" ? "mp4" : "jpg");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const filePath = join(UPLOAD_DIR, dir, filename);

  await Bun.write(filePath, file);

  return c.json({ url: `/uploads/${dir}/${filename}` });
});

app.delete("/api/upload/*", async (c) => {
  const path = c.req.path.replace("/api/upload/", "");
  const filePath = join(UPLOAD_DIR, path);

  // Prevent directory traversal
  if (path.includes("..")) {
    return c.json({ error: "invalid path" }, 400);
  }

  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "delete failed" }, 500);
  }
});

// ─── STATIC FILES ───

app.use("/uploads/*", serveStatic({ root: "./" }));
app.use("/*", serveStatic({ root: "./public" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
