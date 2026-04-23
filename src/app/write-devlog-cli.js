// write-devlog-cli.js 负责写入“代码开发日志”。
//
// 用法示例：
//   echo '{"project":"career-dev-agent","summary":"实现 Git inspect 命令","durationMinutes":120}' \
//     | node ./bin/career-dev-agent.js write-devlog --repo /home/jovyan/career-dev-agent --stdin

const { addRecord } = require("../infra/store");
const { getIsoWeek, parseArgs, readStdinJson, todayDateString } = require("../infra/cli-utils");
const { inspectGitRepo } = require("../infra/git-inspector");

async function runWriteDevlogCommand(config) {
  const options = parseArgs(process.argv.slice(3));

  if (!options.stdin) {
    throw new Error("write-devlog currently requires --stdin");
  }

  const input = await readStdinJson();
  const date = String(input.date || options.date || todayDateString()).trim();

  // 如果用户传了 --repo，就自动读取 Git 仓库状态。
  // 如果不传 --repo，也允许只写手动开发日志。
  const git = options.repo ? inspectGitRepo(options.repo) : null;

  const record = {
    id: `devlog:${date}:${Date.now()}`,
    type: "devlog",
    date,
    week: getIsoWeek(date),
    createdAt: new Date().toISOString(),

    project: String(input.project || "").trim(),
    summary: String(input.summary || "").trim(),
    durationMinutes: Number(input.durationMinutes || 0),
    skills: Array.isArray(input.skills) ? input.skills : [],

    // bugs 用来记录今天遇到和解决的问题。
    // 先允许用户手写数组，后面可以让 LLM 自动生成。
    bugs: Array.isArray(input.bugs) ? input.bugs : [],

    // tests 用来记录测试命令和结果。
    // 例如：
    //   { "command": "npm test", "result": "passed" }
    tests: input.tests && typeof input.tests === "object" ? input.tests : null,

    // git 是客观仓库信息，来自 inspectGitRepo。
    git,
  };

  validateDevlogRecord(record);
  addRecord(config, record);

  console.log(JSON.stringify({
    ok: true,
    id: record.id,
    type: record.type,
    date: record.date,
    gitAttached: Boolean(record.git),
  }, null, 2));
}

function validateDevlogRecord(record) {
  if (!record.project) {
    throw new Error("devlog record requires project");
  }
  if (!record.summary) {
    throw new Error("devlog record requires summary");
  }
  if (!Number.isFinite(record.durationMinutes) || record.durationMinutes <= 0) {
    throw new Error("devlog record requires positive durationMinutes");
  }
}

module.exports = { runWriteDevlogCommand };
