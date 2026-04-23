// git-inspector.js 负责读取 Git 仓库信息。
//
// 这里用 Node.js 调系统命令：
//   git status --short
//   git diff --stat
//   git log --oneline
//
// 注意：这里不会修改仓库，只读取信息。

const { execFileSync } = require("child_process");
const path = require("path");

function inspectGitRepo(repoPath) {
  const repo = path.resolve(repoPath || process.cwd());

  // 先确认这个目录是不是 Git 仓库。
  const root = runGit(repo, ["rev-parse", "--show-toplevel"]).trim();
  const branch = runGit(repo, ["branch", "--show-current"]).trim();
  const statusText = runGit(repo, ["status", "--short"]);
  const diffStatText = runGit(repo, ["diff", "--stat"]);
  const changedFilesText = runGit(repo, ["diff", "--name-only"]);
  const recentCommitsText = runGit(repo, ["log", "--oneline", "-n", "5"]);

  const changedFiles = splitLines(changedFilesText);
  const statusLines = splitLines(statusText);

  return {
    repo,
    root,
    branch: branch || "detached",
    dirty: statusLines.length > 0,
    status: statusLines,
    changedFiles,
    diffStat: parseDiffStat(diffStatText),
    recentCommits: parseRecentCommits(recentCommitsText),
  };
}

function runGit(repo, args) {
  try {
    // execFileSync 会执行一个命令，并等待它结束。
    // cwd 表示在哪个目录下执行命令。
    return execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const message = error && error.stderr ? String(error.stderr).trim() : "";
    throw new Error(message || `git command failed: git ${args.join(" ")}`);
  }
}

function splitLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRecentCommits(text) {
  return splitLines(text).map((line) => {
    const firstSpaceIndex = line.indexOf(" ");

    if (firstSpaceIndex === -1) {
      return {
        hash: line,
        message: "",
      };
    }

    return {
      hash: line.slice(0, firstSpaceIndex),
      message: line.slice(firstSpaceIndex + 1),
    };
  });
}

function parseDiffStat(text) {
  const lines = splitLines(text);
  const summary = lines[lines.length - 1] || "";

  return {
    text: String(text || "").trim(),
    filesChanged: readNumberBefore(summary, "file"),
    insertions: readNumberBefore(summary, "insertion"),
    deletions: readNumberBefore(summary, "deletion"),
  };
}

function readNumberBefore(text, word) {
  // 处理类似：
  //   "3 files changed, 120 insertions(+), 20 deletions(-)"
  const pattern = new RegExp(`(\\d+)\\s+${word}`);
  const match = String(text || "").match(pattern);
  return match ? Number(match[1]) : 0;
}

module.exports = { inspectGitRepo };
