// Fastify server - API + Web UI
// Runs via: aiscribe server
// Or inside Docker via: aiscribe server --docker

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import * as path from "path";
import * as fs from "fs";

const AISCRIBE_DIR = path.join(process.cwd(), ".aiscribe");

interface SessionData {
  id: string;
  date: string;
  branch: string;
  projectPath?: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  summary?: string;
  aiTool?: string;
  rawDiff?: string;
  rawContext?: string;
}

// In-memory store (replaces PostgreSQL when DB is not available)
class MemoryStore {
  private sessions: Map<string, SessionData> = new Map();

  add(session: SessionData): void {
    this.sessions.set(session.id, session);
  }

  getAll(): SessionData[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  get(id: string): SessionData | undefined {
    return this.sessions.get(id);
  }

  count(): number {
    return this.sessions.size;
  }
}

export async function startServer(port: number = 3848, isDocker: boolean = false) {
  const fastify = Fastify({ logger: false });

  const store = new MemoryStore();

  // Load existing sessions from .aiscribe/sessions/ on startup
  loadExistingSessions(store);

  // API routes
  fastify.get("/api/health", async () => {
    return { status: "ok", sessions: store.count() };
  });

  fastify.get("/api/sessions", async () => {
    return store.getAll().map((s) => ({
      id: s.id,
      date: s.date,
      branch: s.branch,
      filesChanged: s.filesChanged,
      insertions: s.insertions,
      deletions: s.deletions,
      summary: s.summary ? s.summary.slice(0, 200) : null,
      aiTool: s.aiTool || null,
    }));
  });

  fastify.get<{ Params: { id: string } }>("/api/sessions/:id", async (req, reply) => {
    const session = store.get(req.params.id);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }
    return session;
  });

  // Serve web UI
  const webDir = path.join(__dirname, "..", "..", "web");
  if (fs.existsSync(webDir)) {
    await fastify.register(fastifyStatic, {
      root: webDir,
      prefix: "/",
    });
  }

  // If web dir doesn't exist, serve inline HTML
  fastify.get("/", async (req, reply) => {
    if (fs.existsSync(path.join(webDir, "index.html"))) {
      return reply.sendFile("index.html");
    }
    reply.type("text/html");
    return getInlineWebUI();
  });

  const host = isDocker ? "0.0.0.0" : "localhost";

  await fastify.listen({ port, host });
  console.log(`\n  AIScribe server running at http://${host}:${port}`);
  console.log(`  Sessions: ${store.count()}`);
  console.log(`  Press Ctrl+C to stop\n`);

  return fastify;
}

function loadExistingSessions(store: MemoryStore): void {
  const sessionsDir = path.join(AISCRIBE_DIR, "sessions");
  if (!fs.existsSync(sessionsDir)) return;

  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const content = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
    const id = file.replace(".md", "");
    const data = parseSessionMarkdown(id, content);
    if (data) store.add(data);
  }
}

function parseSessionMarkdown(id: string, content: string): SessionData | null {
  try {
    const lines = content.split("\n");
    const branch = lines[0]?.replace("# Session: ", "").trim() || "unknown";
    const dateLine = lines.find((l) => l.startsWith("**Date:**"));
    const filesLine = lines.find((l) => l.startsWith("**Files changed:**"));
    const linesLine = lines.find((l) => l.startsWith("**Lines:**"));

    // Extract summary (text after the --- separator, before ## Chunks)
    const separatorIdx = lines.findIndex((l) => l.trim() === "---");
    const chunksIdx = lines.findIndex((l) => l.startsWith("## Chunks"));
    const summary =
      separatorIdx >= 0 && chunksIdx > separatorIdx
        ? lines.slice(separatorIdx + 1, chunksIdx).join("\n").trim()
        : "";

    return {
      id,
      date: dateLine?.replace("**Date:** ", "").trim() || new Date().toISOString(),
      branch,
      filesChanged: parseInt(filesLine?.replace("**Files changed:** ", "") || "0"),
      insertions: parseInt(linesLine?.replace("**Lines:** ", "").split("/")[0]?.replace("+", "") || "0"),
      deletions: parseInt(linesLine?.replace("**Lines:** ", "").split("/")[1]?.trim()?.replace("-", "") || "0"),
      summary: summary || content.slice(0, 500),
      rawDiff: "",
    };
  } catch {
    return null;
  }
}

function getInlineWebUI(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AIScribe - Session Book</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: #f0f6fc; }
    .subtitle { color: #8b949e; font-size: 0.9rem; margin-bottom: 2rem; }
    .session-card { border: 1px solid #21262d; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; cursor: pointer; transition: border-color 0.15s; background: #161b22; }
    .session-card:hover { border-color: #30363d; }
    .session-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .session-branch { font-weight: 600; font-size: 1.05rem; color: #f0f6fc; }
    .session-meta { font-size: 0.8rem; color: #8b949e; display: flex; gap: 1rem; }
    .session-summary { font-size: 0.9rem; color: #8b949e; line-height: 1.5; margin-top: 0.5rem; }
    .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb44; }
    .detail-view { display: none; }
    .detail-view.active { display: block; }
    .back-btn { background: none; border: 1px solid #30363d; color: #c9d1d9; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-bottom: 1.5rem; font-size: 0.85rem; }
    .back-btn:hover { border-color: #58a6ff; color: #f0f6fc; }
    pre { background: #0d1117; border: 1px solid #21262d; border-radius: 8px; padding: 1.25rem; overflow-x: auto; font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap; }
    .empty { text-align: center; padding: 4rem 2rem; color: #8b949e; }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
    .loading { text-align: center; padding: 2rem; color: #8b949e; }
    .tool-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: #23863622; color: #3fb950; border: 1px solid #23863644; }
  </style>
</head>
<body>
  <div class="container" id="app">
    <div id="list-view">
      <h1>AIScribe - Session Book</h1>
      <p class="subtitle">Every AI coding session, recorded. Click a session to read.</p>
      <div id="sessions-list"><div class="loading">Loading sessions...</div></div>
    </div>
    <div id="detail-view" class="detail-view">
      <button class="back-btn" onclick="showList()">← Back to sessions</button>
      <div id="detail-content"></div>
    </div>
  </div>
  <script>
    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        const sessions = await res.json();
        const list = document.getElementById('sessions-list');
        if (sessions.length === 0) {
          list.innerHTML = '<div class="empty"><div class="empty-icon">📝</div><p>No sessions recorded yet.</p><p style="margin-top:0.5rem">Run <code>aiscribe log</code> in your project.</p></div>';
          return;
        }
        list.innerHTML = sessions.map(s => '<div class="session-card" onclick="showSession(\\'' + s.id + '\\')">' +
          '<div class="session-header">' +
            '<span class="session-branch">' + esc(s.branch) + '</span>' +
            (s.aiTool ? '<span class="tool-badge">' + esc(s.aiTool) + '</span>' : '') +
          '</div>' +
          '<div class="session-meta">' +
            '<span>' + formatDate(s.date) + '</span>' +
            '<span>' + s.filesChanged + ' files</span>' +
            '<span>+' + s.insertions + '/-' + s.deletions + '</span>' +
          '</div>' +
          (s.summary ? '<div class="session-summary">' + esc(s.summary.slice(0, 300)) + '</div>' : '') +
        '</div>').join('');
      } catch(e) {
        document.getElementById('sessions-list').innerHTML = '<div class="empty"><p>Could not connect to the server.</p></div>';
      }
    }

    async function showSession(id) {
      try {
        const res = await fetch('/api/sessions/' + id);
        const s = await res.json();
        document.getElementById('list-view').style.display = 'none';
        document.getElementById('detail-view').classList.add('active');
        document.getElementById('detail-content').innerHTML =
          '<h1 style="margin-bottom:0.5rem">' + esc(s.branch) + '</h1>' +
          '<div class="session-meta" style="margin-bottom:1.5rem">' +
            '<span>' + formatDate(s.date) + '</span>' +
            '<span>' + s.filesChanged + ' files</span>' +
            '<span>+' + s.insertions + '/-' + s.deletions + '</span>' +
            (s.aiTool ? '<span class="tool-badge">' + esc(s.aiTool) + '</span>' : '') +
          '</div>' +
          (s.summary ? '<pre>' + esc(s.summary) + '</pre>' : '<p>No summary available.</p>');
      } catch(e) {
        document.getElementById('detail-content').innerHTML = '<p>Could not load session.</p>';
      }
    }

    function showList() {
      document.getElementById('list-view').style.display = 'block';
      document.getElementById('detail-view').classList.remove('active');
    }

    function formatDate(d) { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
    function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    loadSessions();
  </script>
</body>
</html>`;
}
