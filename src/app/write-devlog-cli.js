// write-devlog-cli.js 负责写入“代码开发日志”。
  //
  // 用法示例：
  //   echo '{"project":"career-dev-agent","summary":"实现 Git inspect 命令","durationMinutes":120}' \
  //     | node ./bin/career-dev-agent.js write-devlog --repo /home/jovyan/career-dev-agent--stdin

  const { addRecord } = require("../infra/store");
  const { getIsoWeek, parseArgs, readStdinJson, todayDateString } = require("../infra/cli-utils");
  const { inspectGitRepo } = require("../infra/git-inspector");

  function buildDevlogRecord(input, options) {
    const date = String(input.date || options.date || todayDateString()).trim();
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
      bugs: Array.isArray(input.bugs) ? input.bugs : [],
      tests: input.tests && typeof input.tests === "object" ? input.tests : null,
      git,
    };

    validateDevlogRecord(record);
    return record;
  }

  async function runWriteDevlogCommand(config) {
    const options = parseArgs(process.argv.slice(3));

    if (!options.stdin) {
      throw new Error("write-devlog currently requires --stdin");
    }

    const input = await readStdinJson();
    const record = buildDevlogRecord(input, options);

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

  module.exports = { buildDevlogRecord, runWriteDevlogCommand };
