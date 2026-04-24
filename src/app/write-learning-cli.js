// write-learning-cli.js 负责写入“学习记录”。
//
// 用法示例：
//   echo '{"topic":"Agent 工具调用","durationMinutes":90,"summary":"学习 CLI tool 设计"}' \
//     | node ./bin/career-dev-agent.js write-learning --stdin

const { addRecord } = require("../infra/store");
const { getIsoWeek, parseArgs, readStdinJson, todayDateString } = require("../infra/cli-utils");

function buildLearningRecord(input, options) {
    const date = String(input.date || options.date || todayDateString()).trim();

    const record = buildLearningRecord(input, options);

    validateLearningRecord(record);
    return record;
  }



async function runWriteLearningCommand(config) {
  const options = parseArgs(process.argv.slice(3));

  if (!options.stdin) {
    throw new Error("write-learning currently requires --stdin");
  }

  const input = await readStdinJson();
  const date = String(input.date || options.date || todayDateString()).trim();

  const record = {
    id: `learning:${date}:${Date.now()}`,
    type: "learning",
    date,
    week: getIsoWeek(date),
    createdAt: new Date().toISOString(),

    // 下面是学习记录的核心字段。
    topic: String(input.topic || "").trim(),
    durationMinutes: Number(input.durationMinutes || 0),
    summary: String(input.summary || "").trim(),

    // skills 是数组，例如 ["Node.js", "CLI", "Agent"]。
    skills: Array.isArray(input.skills) ? input.skills : [],

    // source 可以记录学习来源，例如课程、论文、项目代码。
    source: String(input.source || "").trim(),
  };

  validateLearningRecord(record);
  addRecord(config, record);

  console.log(JSON.stringify({
    ok: true,
    id: record.id,
    type: record.type,
    date: record.date,
  }, null, 2));
}

function validateLearningRecord(record) {
  if (!record.topic) {
    throw new Error("learning record requires topic");
  }
  if (!record.summary) {
    throw new Error("learning record requires summary");
  }
  if (!Number.isFinite(record.durationMinutes) || record.durationMinutes <= 0) {
    throw new Error("learning record requires positive durationMinutes");
  }
}

module.exports = { buildLearningRecord,runWriteLearningCommand };
