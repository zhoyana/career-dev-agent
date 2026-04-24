// agent-llm-cli.js 是调用 OpenAI 的 Agent v2 入口。
  // 当前阶段先让它输出并校验结构化 action，下一步再接 executor。

  const { parseArgs, readStdinText } = require("../infra/cli-utils");
  const { extractAgentActionWithLLM } = require("../infra/openai-client");
  const { executeAgentAction } = require("./agent-action-executor");
  const { validateAndNormalizeAgentAction } = require("../infra/agent-action-validator");

  async function runAgentLlmCommand(config) {
    const options = parseArgs(process.argv.slice(3));

    if (!options.stdin) {
      throw new Error("agent-llm currently requires --stdin");
    }

    const text = await readStdinText();
    const extracted = await extractAgentActionWithLLM(text);
    const action = validateAndNormalizeAgentAction(extracted);

    if (options.dryRun) {
      console.log(JSON.stringify({
        ok: true,
        dryRun: true,
        action,
      }, null, 2));
      return;
  }

  const executionResult = executeAgentAction(config, action, options);

  console.log(JSON.stringify({
    ok: true,
    dryRun: false,
    action,
    execution: executionResult,
  }, null, 2));

  }

  module.exports = { runAgentLlmCommand };
