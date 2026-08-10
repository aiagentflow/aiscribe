import { loadIndex } from "../storage";
import { generateEmbedding, semanticSearch } from "../embeddings";
import { bold, dim, green, yellow, gray, cyan } from "../terminal";
import { jsonSuccess, jsonError } from "../json-output";
import * as fs from "fs";
import * as path from "path";

export async function search(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const isQuiet = args.includes("--quiet") || args.includes("-q");
  const query = args.filter(a => !a.startsWith("-")).join(" ").trim();
  const cmdName = "search";

  if (!query) {
    console.log(`
${bold("aiscribe search <query>")}

Search your session history by meaning, not just keywords.

Examples:
  ${cyan("aiscribe search payment refund")}
  ${cyan("aiscribe search auth bug fix")}
`);
    return;
  }

  if (!isJson && !isQuiet) console.log("");
  const spinner = (await import("../terminal")).createSpinner(
    `Searching sessions for "${query}"...`
  );
  if (!isJson && !isQuiet) spinner.start();

  try {
    // Load all sessions
    const index = loadIndex();
    if (index.sessions.length === 0) {
      spinner.stop("No sessions found");
      if (!isJson) console.log(gray("\n  Run 'aiscribe log' in your project first.\n"));
      return;
    }

    // Try semantic search first (needs embeddings)
    let results: Array<{
      id: string;
      score: number;
      branch: string;
      date: string;
      snippet: string;
    }> = [];

    // Check if any session has embeddings
    const embeddingsDir = path.join(process.cwd(), ".aiscribe", "embeddings");
    const hasEmbeddings =
      fs.existsSync(embeddingsDir) && fs.readdirSync(embeddingsDir).length > 0;

    if (hasEmbeddings) {
      const queryEmbedding = await generateEmbedding(query);
      if (queryEmbedding) {
        // Build session list with embeddings
        const sessionsWithEmbeddings = [];
        for (const s of index.sessions) {
          const embPath = path.join(embeddingsDir, `${s.id}.json`);
          let embedding: number[] | null = null;
          if (fs.existsSync(embPath)) {
            try {
              embedding = JSON.parse(
                fs.readFileSync(embPath, "utf-8")
              ).vector;
            } catch {}
          }

          // Read summary snippet from session file
          const sessionPath = path.join(
            process.cwd(),
            ".aiscribe",
            "sessions",
            s.file
          );
          let snippet = "";
          if (fs.existsSync(sessionPath)) {
            const content = fs.readFileSync(sessionPath, "utf-8");
            const sepIdx = content.indexOf("---");
            if (sepIdx >= 0) {
              snippet = content.slice(sepIdx + 3).trim().slice(0, 200);
            }
          }

          sessionsWithEmbeddings.push({
            id: s.id,
            branch: s.branch,
            date: s.date,
            summarySnippet: snippet,
            embedding,
          });
        }

        results = semanticSearch(
          queryEmbedding.vector,
          sessionsWithEmbeddings,
          10
        );
      }
    }

    // Fallback to keyword search if no semantic results
    if (results.length === 0) {
      if (!isJson && !isQuiet) spinner.stop("Using keyword search (add API key for semantic search)");
      const q = query.toLowerCase();
      results = index.sessions
        .filter(
          (s) =>
            s.branch.toLowerCase().includes(q) ||
            (s.file && s.file.toLowerCase().includes(q))
        )
        .slice(0, 10)
        .map((s) => ({
          id: s.id,
          score: 0,
          branch: s.branch,
          date: s.date,
          snippet: "",
        }));
    } else {
      if (!isJson && !isQuiet) spinner.stop(`Found ${results.length} related sessions`);
    }

    // Display results
    if (isJson) {
      jsonSuccess(cmdName, { query, results, method: hasEmbeddings ? "semantic" : "keyword" });
      return;
    }

    if (isQuiet) {
      for (const r of results) console.log(r.id + " " + r.branch);
      return;
    }

    if (results.length === 0) {
      console.log(gray("\n  No matching sessions found.\n"));
      return;
    }

    console.log("");
    for (const r of results) {
      const date = new Date(r.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const scoreStr =
        r.score > 0 ? dim(` [${Math.round(r.score * 100)}% match]`) : "";
      console.log(
        `  ${bold(r.branch)}${scoreStr}`
      );
      console.log(
        `  ${dim(date)}  ${gray(r.snippet.slice(0, 100))}`
      );
      console.log("");
    }
  } catch (err: any) {
    if (isJson) {
      jsonError(cmdName, err.message);
    } else {
      spinner.fail("Search failed");
      console.log(gray("  " + err.message));
    }
    process.exit(1);
}
}
