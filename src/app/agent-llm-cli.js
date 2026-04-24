// agent-llm-cli.js 是真正调用 OpenAI 的最小 LLM Agent。

  const { addRecord } = require("../infra/store");
  const { parseArgs, readStdinText } = require("../infra/cli-utils");
  const { extractCareerRecordWithLLM } = require("../infra/openai-client");
  const { buildDevlogRecord } = require("./write-devlog-cli");
  const { buildLearningRecord } = require("./write-learning-cli");

  async function runAgentLlmCommand(config) {
    const options = parseArgs(process.argv.slice(3));

    if (!options.stdin) {
      throw new Error("agent-llm currently requires --stdin");
    }

    const text = await readStdinText();
    const extracted = await extractCareerRecordWithLLM(text);

    let record = null;

    if (extracted.intent === "learning") {
      record = buildLearningRecord(extracted, options);
    } else if (extracted.intent === "devlog") {
      record = buildDevlogRecord(extracted, options);
    } else {
      throw new Error(`Unknown LLM intent: ${extracted.intent}`);
    }

    if (!options.dryRun) {
    addRecord(config, record);
  }

  console.log(JSON.stringify({
    ok: true,
    intent: extracted.intent,
    dryRun: Boolean(options.dryRun),
    record,
  }, null, 2));

  }

  module.exports = { runAgentLlmCommand };
