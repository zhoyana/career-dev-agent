// import-chat-cli.js 负责把一段聊天记录批量导入成多条记录。

  const { addRecord } = require("../infra/store");
  const { parseArgs, readStdinText } = require("../infra/cli-utils");
  const { extractRecordsFromChatWithLLM } = require("../infra/openai-chat-importer");
  const { validateAndNormalizeLlmRecord } = require("../infra/llm-record-validator");
  const { buildDevlogRecord } = require("./write-devlog-cli");
  const { buildLearningRecord } = require("./write-learning-cli");

  async function runImportChatCommand(config) {
    const options = parseArgs(process.argv.slice(3));

    if (!options.stdin) {
      throw new Error("import-chat currently requires --stdin");
    }

    const text = await readStdinText();
    const extractedRecords = await extractRecordsFromChatWithLLM(text);

    const builtRecords = [];
    //批量导入

    for (const extracted of extractedRecords) {
      const validated = validateAndNormalizeLlmRecord(extracted);

      let record = null;

      if (validated.intent === "learning") {
        record = buildLearningRecord(validated, options);
      } else if (validated.intent === "devlog") {
        record = buildDevlogRecord(validated, options);
      } else {
        throw new Error(`Unknown LLM intent: ${validated.intent}`);
      }

      builtRecords.push(record);
    }

    if (!options.dryRun) {
      for (const record of builtRecords) {
        addRecord(config, record);
      }
    }

    console.log(JSON.stringify({
      ok: true,
      count: builtRecords.length,
      dryRun: Boolean(options.dryRun),
      records: builtRecords,
    }, null, 2));
  }

  module.exports = { runImportChatCommand };

