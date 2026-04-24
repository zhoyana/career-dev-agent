// agent-llm-cli.js 是真正调用 OpenAI 的最小 LLM Agent。

  const { addRecord } = require("../infra/store");
  const { parseArgs, readStdinText } = require("../infra/cli-utils");
  const { extractCareerRecordWithLLM } = require("../infra/openai-client");
  const { buildDevlogRecord } = require("./write-devlog-cli");
  const { buildLearningRecord } = require("./write-learning-cli");
  const { validateAndNormalizeLlmRecord } = require("../infra/llm-record-validator");

  async function runAgentLlmCommand(config) {
    const options = parseArgs(process.argv.slice(3));

    if (!options.stdin) {
      throw new Error("agent-llm currently requires --stdin");
    }

    const text = await readStdinText();
    const extracted = await extractCareerRecordWithLLM(text);
    const validated = validateAndNormalizeLlmRecord(extracted);

    let record = null;

    if (validated.intent === "learning") {
      record = buildLearningRecord(validated, options);
    } else if (validated.intent === "devlog") {
      record = buildDevlogRecord(validated, options);
    } else {
      throw new Error(`Unknown LLM intent: ${validated.intent}`);
    }


    if (!options.dryRun) {
    addRecord(config, record);
  }

  console.log(JSON.stringify({
    ok: true,
    intent: validated.intent,
    dryRun: Boolean(options.dryRun),
    record,
  }, null, 2));


  }

  module.exports = { runAgentLlmCommand };
