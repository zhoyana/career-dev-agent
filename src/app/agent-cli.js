// agent-cli.js 是最小规则版 Agent。
  // 它把自然语言转成 devlog 记录，然后调用已有 store 写入。

  const { addRecord } = require("../infra/store");
  const { parseArgs, readStdinText } = require("../infra/cli-utils");
  const { buildDevlogRecord } = require("./write-devlog-cli");

  async function runAgentCommand(config) {
    const options = parseArgs(process.argv.slice(3));

    if (!options.stdin) {
      throw new Error("agent currently requires --stdin");
    }

    const text = await readStdinText();
    const input = parseDevlogText(text);

    const record = buildDevlogRecord(input, options);
    addRecord(config, record);

    console.log(JSON.stringify({
      ok: true,
      intent: "devlog",
      record,
    }, null, 2));
  }

  function parseDevlogText(text) {
    const normalizedText = String(text || "").trim();

    return {
      date: "",
      project: extractProject(normalizedText),
      summary: normalizedText,
      durationMinutes: extractDurationMinutes(normalizedText),
      skills: extractSkills(normalizedText),
      bugs: [],
      tests: null,
    };
  }

  function extractProject(text) {
    const match = text.match(/在\s+([a-zA-Z0-9_-]+)\s*项目/);
    return match ? match[1] : "unknown";
  }

  function extractDurationMinutes(text) {
    const hourMatch = text.match(/(\d+)\s*小时/);
    if (hourMatch) {
      return Number(hourMatch[1]) * 60;
    }

    const minuteMatch = text.match(/(\d+)\s*分钟/);
    if (minuteMatch) {
      return Number(minuteMatch[1]);
    }

    return 30;
  }

  function extractSkills(text) {
    const knownSkills = [
      "Node.js",
      "CLI",
      "Git",
      "GitHub",
      "JSON",
      "filter",
      "map",
      "reduce",
      "Agent",
    ];

    return knownSkills.filter((skill) => {
      return text.includes(skill);
    });
  }

  module.exports = { runAgentCommand };
