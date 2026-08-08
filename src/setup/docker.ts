import * as fs from "fs";
import * as path from "path";

const AISCRIBE_DIR = path.join(process.cwd(), ".aiscribe");

export function generateDockerCompose(): string {
  return `version: "3.8"

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: aiscribe-db
    environment:
      POSTGRES_USER: aiscribe
      POSTGRES_PASSWORD: aiscribe
      POSTGRES_DB: aiscribe
    ports:
      - "5433:5432"
    volumes:
      - aiscribe_db:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aiscribe"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build: .
    container_name: aiscribe-server
    environment:
      DATABASE_URL: postgresql://aiscribe:aiscribe@db:5432/aiscribe
      PORT: "3848"
      AISCRIBE_API_KEY: \${AISCRIBE_API_KEY:-}
      AISCRIBE_MODEL: \${AISCRIBE_MODEL:-}
    ports:
      - "3848:3848"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - aiscribe_sessions:/app/.aiscribe

volumes:
  aiscribe_db:
  aiscribe_sessions:
`;
}

export function generateInitSQL(): string {
  return `-- AIScribe database schema
-- Runs on first Docker startup

CREATE EXTENSION IF NOT EXISTS vector;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    branch TEXT NOT NULL,
    project_path TEXT,
    files_changed INTEGER DEFAULT 0,
    insertions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    summary TEXT,
    ai_tool TEXT,
    raw_diff TEXT,
    raw_context TEXT,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompts table (individual prompts within a session)
CREATE TABLE IF NOT EXISTS prompts (
    id SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    timestamp BIGINT,
    tool TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for full-text search on summaries
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_branch ON sessions(branch);
CREATE INDEX IF NOT EXISTS idx_sessions_ai_tool ON sessions(ai_tool);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_sessions_embedding 
    ON sessions USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);
`;
}

export function generateDockerfile(): string {
  return `FROM node:20-alpine

WORKDIR /app

# Install aiscribe globally
RUN npm install -g aiscribe

# The server is built into aiscribe
EXPOSE 3848

CMD ["aiscribe", "server", "--docker"]
`;
}

export function setupDocker(): { files: string[] } {
  ensureDir(AISCRIBE_DIR);

  const files: { name: string; content: string }[] = [
    { name: "docker-compose.yml", content: generateDockerCompose() },
    { name: "init.sql", content: generateInitSQL() },
    { name: "Dockerfile", content: generateDockerfile() },
  ];

  for (const file of files) {
    const filepath = path.join(AISCRIBE_DIR, file.name);
    fs.writeFileSync(filepath, file.content, "utf-8");
  }

  return { files: files.map((f) => path.join(AISCRIBE_DIR, f.name)) };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
