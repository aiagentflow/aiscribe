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

let isGitRepo: boolean | null = null;

async function checkGitRepo(): Promise<boolean> {
  if (isGitRepo !== null) return isGitRepo;
  try {
    await git.status();
    isGitRepo = true;
  } catch {
    isGitRepo = false;
  }
  return isGitRepo;
}

export async function getDiff(): Promise<DiffResult> {
  if (!(await checkGitRepo())) {
    return { files: [], diff: "", stats: { insertions: 0, deletions: 0, filesChanged: 0 } };
  }

  try {
    const diff = await git.diff();
    const diffStaged = await git.diff(["--cached"]);
    const fullDiff = [diffStaged, diff].filter((d) => d.trim()).join("\n");

    const summary = await git.diffSummary();
    const cachedSummary = await git.diffSummary(["--cached"]);

    return {
      files: [...summary.files, ...cachedSummary.files].map((f) => f.file),
      diff: fullDiff,
      stats: {
        insertions: summary.insertions + cachedSummary.insertions,
        deletions: summary.deletions + cachedSummary.deletions,
        filesChanged: summary.files.length + cachedSummary.files.length,
      },
    };
  } catch {
    return { files: [], diff: "", stats: { insertions: 0, deletions: 0, filesChanged: 0 } };
  }
}

export async function getBranchName(): Promise<string> {
  if (!(await checkGitRepo())) return "no-git-repo";
  try {
    const status = await git.status();
    return status.current || "unknown";
  } catch {
    return "unknown";
  }
}
