// inspect-git-cli.js 是 Git 检查命令的 CLI 包装。
//
// 用法示例：
//   node ./bin/career-dev-agent.js inspect-git --repo /home/jovyan/timeline-for-agent-main

const { parseArgs } = require("../infra/cli-utils");
const { inspectGitRepo } = require("../infra/git-inspector");

async function runInspectGitCommand() {
  const options = parseArgs(process.argv.slice(3));
  const repo = options.repo || process.cwd();
  const result = inspectGitRepo(repo);

  console.log(JSON.stringify(result, null, 2));
}

module.exports = { runInspectGitCommand };
