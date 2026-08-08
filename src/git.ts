import simpleGit from "simple-git";

const git = simpleGit();

export interface DiffResult {
  files: string[];
  diff: string;
  stats: {
    insertions: number;
    deletions: number;
    filesChanged: number;
  };
}

export async function getDiff(): Promise<DiffResult> {
  // Get both staged and unstaged changes
  const diff = await git.diff();
  const diffStaged = await git.diff(["--cached"]);
  const fullDiff = [diffStaged, diff].filter((d) => d.trim()).join("\n");

  const summary = await git.diffSummary();

  const stats = {
    insertions: summary.insertions + (await git.diffSummary(["--cached"])).insertions,
    deletions: summary.deletions + (await git.diffSummary(["--cached"])).deletions,
    filesChanged:
      summary.files.length + (await git.diffSummary(["--cached"])).files.length,
  };

  const files = summary.files.map((f) => f.file);

  return { files, diff: fullDiff, stats };
}

export async function getBranchName(): Promise<string> {
  const status = await git.status();
  return status.current || "unknown-branch";
}
