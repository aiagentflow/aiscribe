// Fastify server - API + Web UI
// Runs via: aiscribe server
// Or inside Docker via: aiscribe server --docker

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import * as path from "path";
import * as fs from "fs";

// ── Types ──

interface SessionData {
  id: string;
  date: string;
  branch: string;
  projectPath?: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  summary?: string;
  aiTool?: string | null;
  metadata?: Record<string, unknown>;
}

interface SessionListItem {
  id: string;
  date: string;
  branch: string;
  project: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  summarySnippet: string;
  aiTool: string | null;
}

// ── In-memory store ──

class SessionStore {
  private sessions: Map<string, SessionData> = new Map();

  add(s: SessionData): void {
    this.sessions.set(s.id, s);
  }

  getAll(): SessionData[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  query(opts: {
    page: number;
    perPage: number;
    search: string;
    sort: string;
  }): { items: SessionListItem[]; total: number; page: number; pages: number } {
    let sessions = this.getAll();

    // Search
    if (opts.search) {
      const q = opts.search.toLowerCase();
      sessions = sessions.filter(
        (s) =>
          s.branch.toLowerCase().includes(q) ||
          (s.summary && s.summary.toLowerCase().includes(q))
      );
    }

    // Sort
    if (opts.sort === "files") {
      sessions.sort((a, b) => b.filesChanged - a.filesChanged);
    } else if (opts.sort === "changes") {
      sessions.sort(
        (a, b) =>
          b.insertions + b.deletions - (a.insertions + a.deletions)
      );
    }
    // default: date (already sorted)

    const total = sessions.length;
    const pages = Math.max(1, Math.ceil(total / opts.perPage));
    const page = Math.min(opts.page, pages);
    const start = (page - 1) * opts.perPage;
    const items = sessions.slice(start, start + opts.perPage).map(toListItem);

    return { items, total, page, pages };
  }

  get(id: string): SessionData | undefined {
    return this.sessions.get(id);
  }

  count(): number {
    return this.sessions.size;
  }
}

function toListItem(s: SessionData): SessionListItem {
  return {
    id: s.id,
    date: s.date,
    branch: s.branch,
    project: (s as any).project || path.basename(process.cwd()),
    filesChanged: s.filesChanged,
    insertions: s.insertions,
    deletions: s.deletions,
    summarySnippet: (s.summary || "").replace(/^#+\s+/gm, "").slice(0, 200),
    aiTool: s.aiTool || null,
  };
}

// ── Server ──

export async function startServer(port = 3848, isDocker = false) {
  const fastify = Fastify({ logger: false });
  const store = new SessionStore();

  loadSessionsFromDisk(store);

  // ── API ──

  fastify.get("/api/health", async () => ({
    status: "ok",
    sessions: store.count(),
  }));

  fastify.get<{
    Querystring: { page?: string; search?: string; sort?: string };
  }>("/api/sessions", async (req) => {
    const page = Math.max(1, parseInt(req.query.page || "1") || 1);
    const search = (req.query.search || "").trim();
    const sort = req.query.sort || "date";

    return store.query({ page, perPage: 10, search, sort });
  });

  fastify.get<{ Params: { id: string } }>(
    "/api/sessions/:id",
    async (req, reply) => {
      const s = store.get(req.params.id);
      if (!s) {
        reply.code(404);
        return { error: "Session not found" };
      }
      return s;
    }
  );

  // POST: store a session (used by aiscribe sync)
  fastify.post("/api/sessions", async (req, reply) => {
    const body = req.body as SessionData;
    if (!body.id || !body.branch) {
      reply.code(400);
      return { error: "id and branch are required" };
    }
    store.add({
      id: body.id,
      date: body.date || new Date().toISOString(),
      branch: body.branch,
      filesChanged: body.filesChanged || 0,
      insertions: body.insertions || 0,
      deletions: body.deletions || 0,
      summary: body.summary || "",
      aiTool: body.aiTool || null,
    });
    reply.code(201);
    return { ok: true, id: body.id };
  });

  // Agent-friendly context endpoint
  fastify.get<{ Querystring: { last?: string } }>(
    "/api/context",
    async (req) => {
      const last = Math.min(parseInt(req.query.last || "5") || 5, 20);
      const sessions = store.getAll().slice(0, last);
      const context = sessions.map((s) => ({
        branch: s.branch,
        date: new Date(s.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        files: s.filesChanged,
        changes: `+${s.insertions}/-${s.deletions}`,
        tool: s.aiTool || null,
        summary: (s.summary || "").replace(/^#+\s+/gm, "").trim().slice(0, 300),
      }));
      return {
        project: path.basename(process.cwd()),
        sessions: context,
        total: store.count(),
      };
    }
  );

  // Recent sessions metadata (lightweight for agents)
  fastify.get("/api/sessions/recent", async () => {
    return store.getAll().slice(0, 20).map((s) => ({
      id: s.id,
      branch: s.branch,
      date: s.date,
      files: s.filesChanged,
      insertions: s.insertions,
      deletions: s.deletions,
      tool: s.aiTool,
    }));
  });

  // ── Web UI ──

  // Serve web directory as static files
  const webDir = path.join(__dirname, "..", "..", "web");
  if (fs.existsSync(webDir)) {
    await fastify.register(fastifyStatic, {
      root: webDir,
      prefix: "/",
    });
  }

  // Fallback inline UI if no web dir
  fastify.get("/", async (_req, reply) => {
    if (fs.existsSync(path.join(webDir, "index.html"))) {
      return reply.sendFile("index.html");
    }
    reply.type("text/html");
    return "<html><body><h1>AIScribe Server</h1><p>Web UI not found. Run <code>aiscribe setup</code> first.</p></body></html>";
  });

  const host = isDocker ? "0.0.0.0" : "localhost";

  // Auto-assign next available port if default is in use
  let currentPort = port;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fastify.listen({ port: currentPort, host });
      console.log(`\n  AIScribe server: http://${host}:${currentPort}`);
      console.log(`  Sessions loaded: ${store.count()}`);
      if (currentPort !== port) console.log(`  (Port ${port} was busy, using ${currentPort})`);
      console.log(`  Press Ctrl+C to stop\n`);
      return fastify;
    } catch (err: any) {
      if (err.code === "EADDRINUSE") { currentPort++; continue; }
      throw err;
    }
  }
  throw new Error("No available port found.");
}

// ── Disk loader ──

function loadSessionsFromDisk(store: SessionStore): void {
  const dir = path.join(process.cwd(), ".aiscribe", "sessions");
  if (!fs.existsSync(dir)) return;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const s = parseMarkdown(file.replace(".md", ""), content);
    if (s) store.add(s);
  }
}

function parseMarkdown(id: string, md: string): SessionData | null {
  try {
    const lines = md.split("\n");
    const branch = (lines[0] || "").replace(/^#\s+Session:\s*/i, "").trim() || "unknown";
    const dateMatch = md.match(/\*\*Date:\*\*\s*(.+)/);
    const filesMatch = md.match(/\*\*Files changed:\*\*\s*(\d+)/);
    const insMatch = md.match(/\*\*Lines:\*\*\s*\+(\d+)\s*\/\s*-(\d+)/);

    // Extract tool if present
    const toolMatch = md.match(/\*\*AI Tool:\*\*\s*(.+)/);

    // Summary: everything after --- separator, up to ## Chunks or ## Key Decisions
    const sepIdx = lines.findIndex((l) => l.trim() === "---");
    let summary = "";
    if (sepIdx >= 0) {
      const rest = lines.slice(sepIdx + 1);
      const endIdx = rest.findIndex(
        (l) => l.startsWith("## Chunks") || l.startsWith("## Key Decisions")
      );
      summary = (endIdx >= 0 ? rest.slice(0, endIdx) : rest).join("\n").trim();
    }

    return {
      id,
      date: dateMatch ? dateMatch[1].trim() : new Date().toISOString(),
      branch,
      filesChanged: filesMatch ? parseInt(filesMatch[1]) : 0,
      insertions: insMatch ? parseInt(insMatch[1]) : 0,
      deletions: insMatch ? parseInt(insMatch[2]) : 0,
      summary: summary || md.slice(0, 500),
      aiTool: toolMatch ? toolMatch[1].trim() : null,
    };
  } catch {
    return null;
  }
}
